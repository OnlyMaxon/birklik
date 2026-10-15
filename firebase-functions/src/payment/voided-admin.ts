#!/usr/bin/env ts-node
/**
 * Сверка возвратов Google Play руками.
 *
 * ```
 * pnpm payments:voided   прогоняет сверку прямо сейчас
 * ```
 *
 * Зачем, если есть расписание: первый прогон после выкладки надо увидеть своими
 * глазами, не дожидаясь ночи. И когда приходит письмо «мне вернули деньги, а
 * тариф остался» — проверять надо сразу, а не к утру.
 *
 * ⚠️ Прогон МЕНЯЕТ данные: снимает тарифы и подъёмы по возвращённым покупкам.
 * Повтор безопасен — разобранные чеки помечены и второй раз не трогаются.
 *
 * ⚠️ Работает по ПРОДАКШЕНУ: ключ сервис-аккаунта лежит рядом с репозиторием и в
 * него не входит.
 */

import * as path from 'path';
import {admin} from '../firebase-admin';
import {syncVoidedPurchases} from './voided-purchases';

const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');

try {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
} catch (error) {
  console.error('Не удалось подключиться к Firebase:', error);
  process.exit(1);
}

void (async () => {
  console.log('Сверка возвратов Google Play за последнюю неделю...\n');
  try {
    const result = await syncVoidedPurchases();
    console.log('');
    console.log(`получено возвратов   ${result.seen}`);
    console.log(`забрали оплаченное   ${result.revoked}`);
    console.log(`уже было разобрано   ${result.known}`);
    console.log(`чеков не знаем       ${result.unknown}`);
    console.log('');
    console.log('«Чеков не знаем» — это норма: так выглядит покупка, которую');
    console.log('Google вернул сам через три дня, потому что мы не успели её');
    console.log('подтвердить. Ровно та страховка, на которой держится расход товара.');
  } catch (error) {
    console.error('Сверка не удалась:', error);
    process.exit(1);
  }
  process.exit(0);
})();
