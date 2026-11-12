import {admin} from '../firebase-admin';
import {PLATFORM_CURRENCY, productPriceAzn} from '../payment/prices';

/**
 * Счётчик выручки по месяцам.
 *
 * Задача владельца 2026-11-12: видеть, сколько площадка заработала за месяц,
 * не заходя в три разные консоли — банка, Google Play и App Store.
 *
 * ## Почему триггер, а не запись из кассы
 *
 * Касс три, и четвёртая однажды появится. Если каждая будет сама прибавлять к
 * счётчику, то новая касса про счётчик забудет — и забудет молча, выручка
 * просто окажется меньше настоящей, а заметить это можно только сверкой с
 * банком. Поэтому считаем ПО СЛЕДУ: журнал `payments` уже общий для всех касс,
 * и всё, что в него попало, попадёт и в счётчик. Та же причина, по которой
 * журнал правок тарифа сделан триггером `auditTierChanges`, а не записью из
 * браузера.
 *
 * ## Почему отдельная коллекция, а не подсчёт по журналу на лету
 *
 * Журнал растёт, а модераторка открывается с телефона. Читать оттуда все
 * платежи за месяц ради одного числа — лишние чтения на каждом открытии
 * вкладки. Здесь же месяц это ОДИН документ: открыл вкладку — прочитал
 * двенадцать документов за год.
 *
 * ## Срабатывание дважды — норма, и к ней готовились
 *
 * Триггеры Cloud Functions доставляются «не реже одного раза»: одно и то же
 * событие может прийти дважды. Без защиты платёж на 55 манат посчитался бы
 * дважды, и расхождение с банком объяснить было бы нечем. Защита — отметка
 * `revenueCountedAt` на самом платеже, ставится в ОДНОЙ транзакции с
 * прибавкой. Повтор видит отметку и уходит ни с чем.
 *
 * ⚠️ Отметка пишется в тот же документ `payments`, на который стоит триггер, —
 * то есть вызывает его ещё раз. Это не рекурсия: второй заход видит отметку и
 * заканчивается первым же условием. Одно лишнее срабатывание на платёж — цена
 * за то, что счётчик нельзя сбить повтором.
 */

/**
 * Курс доллара к манату.
 *
 * Манат привязан к доллару Центробанком и не плавает — курс держится 1.70 с
 * 2017 года. Поэтому число записано здесь, а не спрашивается у внешней службы:
 * ещё один сетевой вызов в триггере платежа добавил бы точку отказа ради
 * знания, которое не меняется.
 *
 * ⚠️ Если привязку когда-нибудь отменят — править здесь, и прошлые месяцы при
 * этом НЕ пересчитываются: каждый месяц посчитан по курсу своего времени, и
 * это правильно.
 */
export const USD_TO_AZN = 1.7;

/**
 * Азербайджан живёт в UTC+4 круглый год — перевод часов отменён в 2016-м.
 *
 * ⚠️ Нужно именно для границы месяца: платёж в 02:00 первого декабря по Баку
 * случается в 22:00 тридцатого ноября по UTC. Считай мы по UTC — деньги попали
 * бы в ноябрь, а владелец увидел бы их в своей декабрьской выписке. Месяц у нас
 * бакинский.
 */
const BAKU_OFFSET_MS = 4 * 60 * 60 * 1000;

/** Касса. У записей банка поля `provider` нет — они старше второй кассы. */
export type RevenueProvider = 'azericard' | 'app_store' | 'google_play';

/** Месяц платежа в виде `2026-11` — он же имя документа в коллекции. */
export function bakuMonth(date: Date): string {
  const shifted = new Date(date.getTime() + BAKU_OFFSET_MS);
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${month}`;
}

/** Дата из поля журнала: там лежат и `Timestamp`, и строки ISO. */
function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof admin.firestore.Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
}

/**
 * Сумма платежа в манатах, и чем она получена.
 *
 * Три случая, и путать их нельзя:
 *   `store`    — сумму назвал магазин или банк. Самая точная.
 *   `pricelist`— сумму взяли из нашего прейскуранта: ответ Google по чеку цены
 *                не содержит вовсе. Для азербайджанской витрины точно, для
 *                чужой — оценка.
 *   отсутствие — суммы нет ниоткуда. Платёж в счётчик попадёт ЧИСЛОМ, но не
 *                деньгами, и месяц покажет, сколько таких.
 */
function amountInAzn(payment: Record<string, unknown>): {
  azn?: number;
  amount?: number;
  currency: string;
  estimated: boolean;
  unconverted: boolean;
} {
  const raw = typeof payment.amount === 'number' ? payment.amount : undefined;
  // У записей банка поля валюты нет — он считает только манатами.
  const currency = typeof payment.currency === 'string' && payment.currency
    ? payment.currency.toUpperCase()
    : PLATFORM_CURRENCY;
  const estimated = payment.amountSource === 'pricelist';

  // Сумма не записана. Последняя попытка — прейскурант по имени товара: так
  // спасаются записи Google, сделанные до 2026-11-12, когда сумму туда не
  // клали вовсе.
  if (raw === undefined) {
    const productId = typeof payment.productId === 'string' ? payment.productId : '';
    const fallback = productId ? productPriceAzn(productId) : undefined;
    if (fallback === undefined) {
      return {currency, estimated: false, unconverted: false};
    }
    return {azn: fallback, amount: fallback, currency: PLATFORM_CURRENCY, estimated: true, unconverted: false};
  }

  if (currency === PLATFORM_CURRENCY) {
    return {azn: raw, amount: raw, currency, estimated, unconverted: false};
  }
  if (currency === 'USD') {
    return {azn: raw * USD_TO_AZN, amount: raw, currency, estimated, unconverted: false};
  }

  // Валюта, курса которой у нас нет. Сумму в ней записываем честно, в итог
  // манатами НЕ включаем и считаем отдельно: лучше показать «одна покупка не
  // переведена», чем тихо приписать ей неверный курс.
  return {amount: raw, currency, estimated, unconverted: true};
}

/** Касса платежа. Записи банка старше поля `provider`, поэтому он по умолчанию. */
function providerOf(payment: Record<string, unknown>): RevenueProvider {
  const value = payment.provider;
  if (value === 'app_store' || value === 'google_play') return value;
  return 'azericard';
}

/**
 * Прибавляет платёж к месяцу.
 *
 * Считаются ТОЛЬКО `status: 'completed'` и только настоящие покупки: песочница
 * Apple и тестовые чеки Google в выручку не идут — иначе проверяющий Apple
 * своими покупками накрутил бы нам месячный итог.
 *
 * ⚠️ `amount_mismatch` НЕ считается намеренно, хотя деньги там списаны: это
 * недоплата, требующая решения человека — вернуть или доплатить. Пока решения
 * нет, суммы у площадки нет тоже. Такие платежи показывает `pnpm payments:stuck`.
 */
export async function recordPaymentRevenue(
  paymentId: string,
  payment: Record<string, unknown>
): Promise<void> {
  if (payment.status !== 'completed') return;
  if (payment.isTestPurchase === true) return;
  // Дешёвая проверка ДО транзакции. Отметку о подсчёте мы ставим на сам
  // платёж, то есть вызываем этот же триггер ещё раз; без этой строки второй
  // заход честно открывал бы транзакцию, читал документ и закрывал её ни с
  // чем. Настоящая защита от двойного счёта всё равно ниже, внутри
  // транзакции: снимок триггера мог устареть.
  if (payment.revenueCountedAt) return;

  const db = admin.firestore();
  const paymentRef = db.collection('payments').doc(paymentId);

  const at = toDate(payment.completedAt) ?? toDate(payment.createdAt) ?? new Date();
  const month = bakuMonth(at);
  const revenueRef = db.collection('revenue').doc(month);

  const provider = providerOf(payment);
  const kind = payment.kind === 'boost' ? 'boost' : 'tier';
  const money = amountInAzn(payment);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(paymentRef);
    if (!snap.exists) return;

    const fresh = snap.data() ?? {};
    // Уже посчитан. Повторная доставка события, перезапись полей платежа,
    // ручная правка — любой из этих путей приходит сюда второй раз.
    if (fresh.revenueCountedAt) return;
    // Состояние могло измениться между чтением триггера и транзакцией.
    if (fresh.status !== 'completed') return;

    const increment = admin.firestore.FieldValue.increment;

    tx.set(
      revenueRef,
      {
        month,
        usdRate: USD_TO_AZN,
        count: increment(1),
        countByProvider: {[provider]: increment(1)},
        // Сумма в той валюте, в какой её списали. Пустая, если суммы нет.
        ...(money.amount !== undefined
          ? {gross: {[money.currency]: increment(money.amount)}}
          : {}),
        ...(money.azn !== undefined
          ? {
              grossAzn: increment(money.azn),
              byProviderAzn: {[provider]: increment(money.azn)},
              byKindAzn: {[kind]: increment(money.azn)},
            }
          : {}),
        // Три счётчика качества числа. Без них месяц выглядел бы одинаково
        // точным независимо от того, чем он набран.
        ...(money.estimated ? {estimatedCount: increment(1)} : {}),
        ...(money.unconverted ? {unconvertedCount: increment(1)} : {}),
        ...(money.amount === undefined ? {missingAmountCount: increment(1)} : {}),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true}
    );

    tx.update(paymentRef, {
      revenueCountedAt: admin.firestore.FieldValue.serverTimestamp(),
      // Месяц запоминается на самом платеже: по нему возврат найдёт, из какого
      // месяца вычитать. Иначе возврат в декабре уменьшал бы декабрь, а
      // заработан платёж был в ноябре — и ноябрь навсегда остался бы завышен.
      revenueMonth: month,
      ...(money.azn !== undefined ? {revenueAzn: money.azn} : {}),
    });
  });
}

/**
 * Вычитает возвращённый платёж из того месяца, в котором он был заработан.
 *
 * Не уменьшает `grossAzn`, а копит отдельно в `refundedAzn`: владельцу надо
 * видеть обе цифры. «Заработали 300, вернули 55» — это другой разговор, чем
 * «заработали 245», особенно когда возвраты зачастили.
 *
 * ⚠️ Возврат ИЗ КАБИНЕТА банка сюда не доходит — Azericard нас о нём не
 * извещает, это известное свойство, записанное ещё при разборе платежей
 * 2026-10-15. Вычитаются только возвраты магазинов, которые сами ставят
 * платежу `status: 'reversed'`.
 */
export async function recordRefundRevenue(
  paymentId: string,
  payment: Record<string, unknown>
): Promise<void> {
  if (payment.status !== 'reversed') return;
  // Та же дешёвая проверка до транзакции, что и при подсчёте.
  if (payment.revenueRefundedAt) return;

  const db = admin.firestore();
  const paymentRef = db.collection('payments').doc(paymentId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(paymentRef);
    if (!snap.exists) return;

    const fresh = snap.data() ?? {};
    // Не считали — нечего и отнимать. Так бывает с тестовыми покупками и с
    // платежами старше счётчика.
    if (!fresh.revenueCountedAt) return;
    if (fresh.revenueRefundedAt) return;

    const month = typeof fresh.revenueMonth === 'string' ? fresh.revenueMonth : '';
    if (!month) return;

    const azn = typeof fresh.revenueAzn === 'number' ? fresh.revenueAzn : 0;
    const increment = admin.firestore.FieldValue.increment;

    tx.set(
      db.collection('revenue').doc(month),
      {
        month,
        refundedAzn: increment(azn),
        refundCount: increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true}
    );

    tx.update(paymentRef, {
      revenueRefundedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}
