#!/usr/bin/env ts-node
/**
 * Платежи, застрявшие между списанием и выдачей.
 *
 * ```
 * pnpm payments:stuck   показывает подозрительные платежи, НИЧЕГО не меняя
 * ```
 *
 * Зачем такой разбор нужен вообще. Касс две, и доводятся они до конца
 * по-разному:
 *
 * ```
 * Google Play   приложение САМО возвращается к незавершённой покупке при
 *               открытии экрана оплаты, а неподтверждённую покупку Google
 *               через три дня возвращает покупателю сам
 * Azericard     из `awaiting_payment` платёж выходит ТОЛЬКО по колбэку банка.
 *               Колбэк не пришёл — никто об этом не узнает
 * ```
 *
 * ⚠️ Вторая строка и есть дыра, которую этот разбор делает видимой. Если браузер
 * умер между «подтверждено» на стороне банка и нашим `azericardCallback`, карта
 * списана, а тариф не поставлен. Через сутки `expireStalePayments` переведёт
 * запись в `expired` — и на этом всё: сверки с банком у нас нет, повторно
 * спросить Azericard о судьбе заказа код не умеет. Вернуть деньги или выдать
 * оплаченное может только человек, и для этого ему надо такие платежи увидеть.
 *
 * Поэтому вывод сверяется с объявлением: у половины найденных тариф на месте
 * (колбэк пришёл, а запись не обновилась), и разбирать надо только остальные.
 *
 * ⚠️ Работает по ПРОДАКШЕНУ, но только читает. Ключ сервис-аккаунта лежит рядом
 * с репозиторием и в него не входит.
 */

import * as path from 'path';
import {admin} from '../firebase-admin';

const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');

try {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
} catch (error) {
  console.error('Не удалось подключиться к Firebase:', error);
  process.exit(1);
}

/** Сколько часов платёж в ожидании ещё не считается подозрительным. */
const GRACE_HOURS = 2;

type Fields = Record<string, unknown>;

/**
 * Дата по БАКИНСКОМУ времени (UTC+4).
 *
 * Именно она нужна для поиска в кабинете Azericard: там операции показаны по
 * местному времени, а `serverTimestamp` у нас в UTC. Возраст в часах для поиска
 * бесполезен — отсюда и дата рядом с ним.
 *
 * Смещение прибито числом намеренно: в Азербайджане перехода на летнее время
 * нет с 2016 года, UTC+4 круглый год.
 */
function bakuTime(value: unknown): string {
  const ms =
    typeof value === 'string'
      ? new Date(value).getTime()
      : (value as {toMillis?: () => number} | undefined)?.toMillis?.() ?? NaN;
  if (Number.isNaN(ms)) return 'дата неизвестна';
  return new Date(ms + 4 * 3600000).toISOString().replace('T', ' ').slice(0, 16);
}

function ageHours(value: unknown): number {
  if (!value) return Infinity;
  const ms =
    typeof value === 'string'
      ? new Date(value).getTime()
      : (value as {toMillis?: () => number}).toMillis?.() ?? NaN;
  return Number.isNaN(ms) ? Infinity : (Date.now() - ms) / 3600000;
}

/** Действует ли у объявления то, за что заплатили. Копия правила isTierActive. */
function tierActive(data: Fields, tier: unknown): boolean {
  if (tier !== 'vip' && tier !== 'premium') return false;
  const raw = (tier === 'vip' ? data.vipExpiresAt : data.premiumExpiresAt) as string | undefined;
  if (!raw) return false;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T23:59:59.999Z` : raw;
  const parsed = new Date(normalized);
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now();
}

async function describeTarget(payment: Fields): Promise<string> {
  const propertyId = payment.propertyId as string | undefined;
  if (!propertyId) return 'объявление не указано';

  const snap = await admin.firestore().collection('properties').doc(propertyId).get();
  if (!snap.exists) return 'ОБЪЯВЛЕНИЕ УДАЛЕНО';

  const data = (snap.data() ?? {}) as Fields;

  if (payment.kind === 'boost') {
    return data.boostedAt
      ? `подъём есть (${String(data.boostedAt).slice(0, 16)})`
      : 'ПОДЪЁМА НЕТ';
  }

  return tierActive(data, payment.tier)
    ? `тариф на месте (${String(data.listingTier)})`
    : 'ТАРИФА НЕТ';
}

async function listAzericard(): Promise<void> {
  console.log('=== Azericard: платежи без колбэка ===\n');

  const statuses = ['awaiting_payment', 'expired'];
  let found = 0;

  for (const status of statuses) {
    const snap = await admin
      .firestore()
      .collection('payments')
      .where('status', '==', status)
      .limit(200)
      .get();

    for (const doc of snap.docs) {
      const payment = doc.data() as Fields;
      // Платежи из приложения сюда не относятся: у них своё доведение до конца.
      if (payment.provider === 'google_play') continue;

      const hours = ageHours(payment.createdAt);
      if (status === 'awaiting_payment' && hours < GRACE_HOURS) continue;

      found += 1;
      console.log(`заказ      ${payment.orderId ?? doc.id}`);
      console.log(`  начат    ${bakuTime(payment.createdAt)} (Баку)`);
      console.log(`  статус   ${status}, возраст ${Math.round(hours)} ч`);
      console.log(`  куплено  ${payment.kind ?? 'tier'} ${payment.tier ?? payment.boostCount ?? ''} ${payment.duration ?? ''}`);
      console.log(`  сумма    ${payment.amount ?? '—'}`);
      console.log(`  человек  ${payment.userId ?? '—'}`);
      console.log(`  сейчас   ${await describeTarget(payment)}`);
      console.log('');
    }
  }

  if (found === 0) {
    console.log('Застрявших нет.\n');
    return;
  }

  console.log(`Всего: ${found}.`);
  console.log('Строки с «ТАРИФА НЕТ» и «ПОДЪЁМА НЕТ» надо сверить с кабинетом');
  console.log('Azericard: если списание прошло, выдать оплаченное или вернуть деньги.');
  console.log('Остальные — колбэк пришёл, запись просто не обновилась.\n');
}

async function listPlay(): Promise<void> {
  console.log('=== Google Play: чеки, занятые но не применённые ===\n');

  const snap = await admin
    .firestore()
    .collection('playPurchases')
    .where('applied', '==', false)
    .limit(200)
    .get();

  if (snap.empty) {
    console.log('Таких нет.');
    console.log('Это норма: отметка снимается сразу после выдачи оплаченного,');
    console.log('а повторный вызов от приложения доводит незаконченное до конца.\n');
    return;
  }

  for (const doc of snap.docs) {
    const claim = doc.data() as Fields;
    console.log(`заказ      ${claim.orderId ?? '—'}`);
    console.log(`  товар    ${claim.productId ?? '—'}`);
    console.log(`  начат    ${bakuTime(claim.createdAt)} (Баку)`);
    console.log(`  возраст  ${Math.round(ageHours(claim.createdAt))} ч`);
    console.log(`  человек  ${claim.userId ?? '—'}`);
    console.log(`  сейчас   ${await describeTarget(claim)}`);
    console.log('');
  }

  console.log('Такие записи обычно закрываются сами: приложение присылает тот же');
  console.log('чек при открытии экрана оплаты, и покупка доводится до конца.');
  console.log('Висит больше трёх дней — Google уже вернул деньги покупателю.\n');
}

void (async () => {
  await listAzericard();
  await listPlay();
  process.exit(0);
})();
