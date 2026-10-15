import {admin} from '../firebase-admin';

/**
 * Журнал изменений тарифа и подъёма.
 *
 * ⚠️ **Зачем.** `listingTier` и даты окончания пишут два совершенно разных
 * автора: подтверждённая оплата и рука модератора из его редактора. В документе
 * объявления остаётся только результат, и вопрос «кто дал этому объявлению
 * Premium — заплатили или поставили» ответа не имел **вообще**. Разбор платежей
 * 2026-10-15 на этом и застрял: у одного объявления поля тарифа оказались
 * убраны целиком, и доказать, оплата это была или правка, было нечем.
 *
 * ⚠️ **Почему триггером, а не записью из браузера.** Правку через консоль
 * Firebase клиентский журнал не увидел бы никогда — а именно такая у нас и
 * случилась 31 августа: поля тарифа исчезли так, как не делает ни
 * `expirePaidTiers` (она их намеренно не трогает), ни редактор модератора (он
 * пишет пустую строку, а не удаляет поле). Триггер видит любую запись в
 * документ, кем бы она ни была сделана.
 *
 * Цена: функция вызывается на КАЖДУЮ правку объявления. Поэтому первая же
 * проверка — сравнение интересующих полей, и на обычной правке текста или
 * фотографий работа заканчивается там же, без единого запроса в базу.
 *
 * Чего триггер НЕ умеет: знать вошедшего. У записи из триггера нет ни токена,
 * ни заявки — поэтому автор берётся из поля `updatedBy`, которое пишет редактор
 * модератора, и только когда в той же записи поменялся `updatedAt`.
 */

/** Поля, изменение которых стоит денег. Остальные правки журналу не интересны. */
const WATCHED = [
  'listingTier',
  'premiumExpiresAt',
  'vipExpiresAt',
  'isFeatured',
  'boostedAt',
] as const;

/** Коллекция журнала. Пишет только сервер, читает только модератор. */
export const TIER_AUDIT = 'tierAudit';

/**
 * Окно, в котором запись о платеже объясняет изменение тарифа.
 *
 * Оплата и применение идут одним ходом — колбэк банка или проверка чека, —
 * поэтому между записью платежа и правкой объявления секунды. Три минуты это
 * запас на медленный ответ Google и на холодный старт функции, но не настолько
 * большой, чтобы ручная правка «подхватила» чужую недавнюю оплату.
 */
const PAYMENT_WINDOW_MS = 3 * 60 * 1000;

type Fields = Record<string, unknown>;

function changed(before: Fields, after: Fields): string[] {
  return WATCHED.filter(key => {
    const a = before[key];
    const b = after[key];
    // Отсутствие и пустая строка — разные состояния документа, и для выборок
    // это важно (`orderBy` отбирает по наличию поля). Поэтому сравнение строгое,
    // а в журнал пишется то, что было, без приведения.
    return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
  });
}

function toMillis(value: unknown): number {
  if (typeof value === 'string') return new Date(value).getTime();
  return (value as {toMillis?: () => number} | undefined)?.toMillis?.() ?? NaN;
}

/**
 * Что объясняет изменение: оплата, возврат, ночная задача подъёма или рука.
 *
 * Ищется по журналу платежей — тому же, куда пишут обе кассы. Задача подъёма
 * узнаётся по записи остатка пакета: она обновляет `lastBumpAt` в тот же миг.
 */
async function explain(
  propertyId: string,
  fields: string[]
): Promise<{source: string; orderId?: string}> {
  const db = admin.firestore();
  const now = Date.now();

  const payments = await db
    .collection('payments')
    .where('propertyId', '==', propertyId)
    .limit(20)
    .get();

  for (const doc of payments.docs) {
    const p = doc.data() as Fields;
    const stamp =
      p.status === 'reversed'
        ? toMillis(p.reversedAt)
        : p.status === 'completed'
          ? toMillis(p.completedAt ?? p.createdAt)
          : NaN;

    if (Number.isNaN(stamp) || now - stamp > PAYMENT_WINDOW_MS || stamp > now + 60000) continue;

    return {
      source: p.status === 'reversed' ? 'возврат денег' : 'оплата',
      orderId: (p.orderId as string | undefined) ?? undefined,
    };
  }

  // Ночной подъём меняет только `boostedAt` и делает это вместе с записью
  // остатка пакета. Если менялось что-то ещё — это не задача.
  if (fields.length === 1 && fields[0] === 'boostedAt') {
    const boost = await db.collection('boosts').doc(propertyId).get();
    const bump = boost.exists ? toMillis(boost.data()?.lastBumpAt) : NaN;
    if (!Number.isNaN(bump) && now - bump < PAYMENT_WINDOW_MS) {
      return {source: 'ночная задача подъёма'};
    }
  }

  return {source: 'РУКАМИ'};
}

/**
 * Записывает изменение в журнал. Вызывается из триггера в `index.ts`.
 *
 * @returns что записано, или `null` если интересующие поля не менялись.
 */
export async function auditTierChange(params: {
  propertyId: string;
  before: Fields;
  after: Fields;
}): Promise<{fields: string[]; source: string} | null> {
  const {propertyId, before, after} = params;

  const fields = changed(before, after);
  if (fields.length === 0) return null;

  const {source, orderId} = await explain(propertyId, fields);

  // Автору верим только если правка свежая: `updatedBy` без смены `updatedAt`
  // это автор ПРОШЛОЙ правки, и приписать ему чужую работу хуже, чем
  // признаться, что автор неизвестен.
  const freshEdit = before.updatedAt !== after.updatedAt;
  const author = freshEdit ? (after.updatedBy as string | undefined) : undefined;

  const was: Fields = {};
  const now: Fields = {};
  for (const key of fields) {
    was[key] = before[key] ?? null;
    now[key] = after[key] ?? null;
  }

  await admin.firestore().collection(TIER_AUDIT).add({
    propertyId,
    fields,
    was,
    now,
    source,
    ...(orderId ? {orderId} : {}),
    ...(author ? {author} : {}),
    ownerId: (after.ownerId as string | undefined) ?? '',
    at: admin.firestore.FieldValue.serverTimestamp(),
  });

  if (source === 'РУКАМИ') {
    // Громко: изменение тарифа, за которым не стоит оплаты, — это либо работа
    // модератора, либо чья-то ошибка, и видеть такое надо сразу.
    console.warn(
      `[TierAudit] ${propertyId}: ${fields.join(', ')} изменены РУКАМИ` +
        `${author ? `, автор ${author}` : ', автор неизвестен'}`
    );
  } else {
    console.log(`[TierAudit] ${propertyId}: ${fields.join(', ')} — ${source}`);
  }

  return {fields, source};
}
