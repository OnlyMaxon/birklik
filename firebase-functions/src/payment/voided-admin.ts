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

// ⚠️ Ключ надо отдать ДВА раза, и это не дублирование.
//
// `admin.initializeApp` открывает доступ к Firestore. А запрос к Google Play идёт
// мимо Firebase — через `google-auth-library`, и она ищет «учётные данные по
// умолчанию» в переменной окружения. В выложенной функции такие данные есть
// сами: это служебная запись самой функции. На машине их нет, и без этой строки
// прогон падает с «Could not load the default credentials» — ровно так и
// случилось при первом запуске 2026-10-15.
//
// Переменная читается лениво, в момент запроса, поэтому поставить её здесь, уже
// после импортов, достаточно.
process.env.GOOGLE_APPLICATION_CREDENTIALS = serviceAccountPath;

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
    process.exitCode = 1;
  }

  // ⚠️ Выходим ЧЕРЕЗ закрытие соединения, а не `process.exit(0)`.
  //
  // Прогон делает две разные сети: Firestore через gRPC и запрос к Google Play
  // через обычный HTTP с живым соединением. `process.exit` посреди их закрытия
  // ронял процесс с `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` в
  // libuv и кодом выхода 3221226505 — работа при этом была уже сделана, но
  // `pnpm` показывал провал. Так и выглядело при первом запуске 2026-10-15:
  // сверка прошла, а на экране ошибка.
  //
  // Закрываем Firestore и даём процессу закончиться сам. Соединение HTTP
  // отпускается само за несколько секунд.
  await admin.firestore().terminate();
})();
