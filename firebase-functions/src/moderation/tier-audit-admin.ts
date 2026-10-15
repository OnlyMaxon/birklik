#!/usr/bin/env ts-node
/**
 * Журнал изменений тарифа и подъёма — чтение.
 *
 * ```
 * pnpm tier:audit         последние изменения, все
 * pnpm tier:audit --hand  только те, за которыми НЕ стоит оплата
 * ```
 *
 * Отвечает на вопрос, который до 2026-10-15 ответа не имел: «кто дал этому
 * объявлению Premium — заплатили или поставили руками». Разбор платежей на этом
 * и застрял: у одного объявления поля тарифа оказались убраны целиком, и
 * доказать, оплата это была или правка, было нечем.
 *
 * ⚠️ Журнал ведётся С МОМЕНТА ВЫКЛАДКИ триггера. Всё, что случилось раньше, в
 * нём не появится — прошлое не восстановить ниоткуда.
 *
 * ⚠️ Только читает. Запись закрыта правилами всем, включая модератора: журнал,
 * который можно подправить, не журнал.
 */

import * as path from 'path';
import {admin} from '../firebase-admin';
import {TIER_AUDIT} from './tier-audit';

const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');

try {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
} catch (error) {
  console.error('Не удалось подключиться к Firebase:', error);
  process.exit(1);
}

const handOnly = process.argv.includes('--hand');

function bakuTime(value: unknown): string {
  const ms =
    typeof value === 'string'
      ? new Date(value).getTime()
      : (value as {toMillis?: () => number} | undefined)?.toMillis?.() ?? NaN;
  if (Number.isNaN(ms)) return 'дата неизвестна';
  return new Date(ms + 4 * 3600000).toISOString().replace('T', ' ').slice(0, 16);
}

void (async () => {
  let query = admin.firestore().collection(TIER_AUDIT).orderBy('at', 'desc').limit(100);
  if (handOnly) {
    // Отбор в коде, а не вторым условием запроса: равенство плюс сортировка по
    // другому полю требуют составного индекса, а записей здесь десятки.
    query = admin.firestore().collection(TIER_AUDIT).orderBy('at', 'desc').limit(300);
  }

  const snapshot = await query.get();
  const docs = handOnly
    ? snapshot.docs.filter(d => d.data().source === 'РУКАМИ')
    : snapshot.docs;

  if (docs.length === 0) {
    console.log(handOnly ? 'Правок руками не было.' : 'Журнал пуст.');
    console.log('');
    console.log('Если это неожиданно — проверь, что триггер auditTierChanges выложен:');
    console.log('журнал ведётся только с момента его выкладки.');
    process.exit(0);
  }

  console.log(`Записей: ${docs.length}${handOnly ? ' (только правки руками)' : ''}\n`);

  for (const doc of docs) {
    const d = doc.data();
    console.log(`${bakuTime(d.at)} (Баку)  ${d.source}`);
    console.log(`  объявление  ${d.propertyId}`);
    console.log(`  поля        ${(d.fields as string[]).join(', ')}`);
    for (const field of d.fields as string[]) {
      const was = d.was?.[field];
      const now = d.now?.[field];
      console.log(
        `    ${field.padEnd(18)} ${String(was ?? '— (не было)')} → ${String(now ?? '— (убрано)')}`
      );
    }
    if (d.orderId) console.log(`  заказ       ${d.orderId}`);
    console.log(`  автор       ${d.author ?? 'неизвестен'}`);
    console.log('');
  }

  console.log('«РУКАМИ» означает, что оплаты за этим изменением НЕ стоит.');
  console.log('«автор неизвестен» — правка не из редактора модератора: скорее');
  console.log('всего консоль Firebase или скрипт. Редактор автора записывает.');
  process.exit(0);
})();
