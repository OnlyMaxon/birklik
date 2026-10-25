#!/usr/bin/env ts-node
/**
 * Проверка адреса уведомлений App Store руками.
 *
 * ```
 * pnpm apple:test-notify -- --key D:/VS/Birklik-mobile/Keys/AuthKey_XXXXXXXXXX.p8 --issuer <uuid>
 * pnpm apple:test-notify -- --key ... --issuer ... --sandbox
 * ```
 *
 * ⚠️ **Зачем скрипт, а не кнопка.** В App Store Connect кнопки «отправить
 * проверочное уведомление» НЕТ — проверено глазами 2026-10-25: на странице
 * `App Information` есть только два поля с адресами и «Редактировать». Запросить
 * проверку можно единственным способом — обращением к App Store Server API,
 * подписанным ключом In-App Purchase.
 *
 * ⚠️ **Запускается РУКАМИ и ничего не меняет.** Ни тарифов, ни объявлений, ни
 * записей: Apple присылает на наш адрес пустое уведомление типа `TEST`, а
 * `appleNotifications` на него только пишет строку в журнал. Повторять можно
 * сколько угодно.
 *
 * ⚠️ **Ключ в репозиторий не попадает.** Скрипт получает ПУТЬ к `.p8` на диске —
 * файлы лежат в `D:\VS\Birklik-mobile\Keys`, эта папка закрыта от гита целиком.
 * Содержимое ключа нигде не печатается.
 *
 * ## Что доказывает прогон
 *
 * ```
 * ответ Apple на запрос     ключ создан НУЖНОГО типа (In-App Purchase),
 *                           а не DeviceCheck и не APNs — их четыре, и
 *                           отличить их иначе нечем
 * sendAttemptResult         Apple ДОСТУЧАЛАСЬ до нашего адреса и что мы ответили
 * разбор подписи            наш собственный проверяльщик согласен с Apple
 * ```
 *
 * Последнее важнее всего: до этого прогона ни одна строка кода Apple у нас
 * никогда не исполнялась.
 */

import * as fs from 'fs';
import * as path from 'path';

import {AppStoreServerAPIClient, Environment} from '@apple/app-store-server-library';

import {APPLE_BUNDLE_ID, verifyAppleNotification} from './app-store';

/** Сколько раз спрашивать Apple о судьбе уведомления и с какой паузой. */
const STATUS_TRIES = 6;
const STATUS_PAUSE_MS = 5000;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

/**
 * Номер ключа из имени файла.
 *
 * Apple отдаёт ключи файлами вида `AuthKey_LDN5SZX76Z.p8`, где между `AuthKey_`
 * и расширением стоит ровно тот Key ID, который требуется в запросе. Просить его
 * отдельно значило бы просить переписать то, что уже лежит на диске, — и дать
 * шанс перепутать ключи между собой.
 */
function keyIdFromFileName(file: string): string | undefined {
  const m = /^AuthKey_([A-Z0-9]+)\.p8$/i.exec(path.basename(file));
  return m?.[1];
}

async function main(): Promise<void> {
  const keyPath = arg('key');
  const issuerId = arg('issuer') ?? process.env.APPLE_ISSUER_ID;
  const sandbox = process.argv.includes('--sandbox');

  if (!keyPath) {
    console.error('Нужен путь к ключу: --key D:/VS/Birklik-mobile/Keys/AuthKey_XXXXXXXXXX.p8');
    process.exitCode = 1;
    return;
  }
  if (!fs.existsSync(keyPath)) {
    console.error(`Файла нет: ${keyPath}`);
    process.exitCode = 1;
    return;
  }
  if (!issuerId) {
    console.error(
      'Нужен Issuer ID: --issuer <uuid>. Он один на всю команду и лежит в\n' +
      'App Store Connect → Users and Access → Integrations → In-App Purchase,\n' +
      'строкой над списком ключей.'
    );
    process.exitCode = 1;
    return;
  }

  const keyId = arg('key-id') ?? keyIdFromFileName(keyPath);
  if (!keyId) {
    console.error(
      'Не удалось взять Key ID из имени файла. Переименуй его обратно в\n' +
      '`AuthKey_XXXXXXXXXX.p8` либо передай --key-id XXXXXXXXXX.'
    );
    process.exitCode = 1;
    return;
  }

  const environment = sandbox ? Environment.SANDBOX : Environment.PRODUCTION;
  const privateKey = fs.readFileSync(keyPath, 'utf8');

  console.log(`Среда       ${sandbox ? 'ПЕСОЧНИЦА' : 'БОЙ'}`);
  console.log(`Приложение  ${APPLE_BUNDLE_ID}`);
  console.log(`Ключ        ${keyId}`);
  console.log('');

  const client = new AppStoreServerAPIClient(
    privateKey,
    keyId,
    issuerId,
    APPLE_BUNDLE_ID,
    environment
  );

  let token: string | undefined;
  try {
    const response = await client.requestTestNotification();
    token = response.testNotificationToken;
    console.log('Apple приняла запрос. Уведомление отправлено на адрес из App Store Connect.');
    console.log(`Метка проверки: ${token}`);
    console.log('');
  } catch (error) {
    // ⚠️ Самый частый отказ здесь — НЕ «адрес не настроен», а неподходящий ключ.
    // Их у нас четыре разных: APNs, DeviceCheck, In-App Purchase и ключ
    // App Store Connect API. Снаружи все `.p8`, и отличаются только правами.
    console.error('Запрос не удался:', error);
    console.error('');
    console.error('Если ответ про права или ключ — почти наверняка взят не тот .p8.');
    console.error('Нужен ключ In-App Purchase: App Store Connect → Users and Access →');
    console.error('Integrations → In-App Purchase. Ключи APNs и DeviceCheck сюда не годятся.');
    process.exitCode = 1;
    return;
  }

  // ⚠️ Метку Apple объявляет необязательной, и это не придирка типов: без неё
  // спросить о судьбе уведомления НЕЧЕМ. Запрос при этом считается принятым —
  // то есть уведомление ушло, а узнать, доехало ли, мы уже не сможем.
  if (!token) {
    console.error('Apple не вернула метку проверки. Запрос принят, но судьбу не спросить.');
    console.error('Смотри журнал функции напрямую — уведомление должно было дойти.');
    process.exitCode = 1;
    return;
  }

  // ⚠️ Спрашиваем НЕ сразу: Apple отправляет уведомление и только потом
  // записывает, чем кончилось. Первые пару секунд ответ законно пустой.
  for (let attempt = 1; attempt <= STATUS_TRIES; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, STATUS_PAUSE_MS));

    let status;
    try {
      status = await client.getTestNotificationStatus(token);
    } catch (error) {
      console.error(`Попытка ${attempt}: спросить о судьбе не удалось:`, error);
      continue;
    }

    const attempts = status.sendAttempts ?? [];
    if (attempts.length === 0) {
      console.log(`Попытка ${attempt}: Apple ещё не записала результат, ждём...`);
      continue;
    }

    console.log('Что видит Apple со своей стороны:');
    for (const a of attempts) {
      const when = a.attemptDate ? new Date(a.attemptDate).toISOString() : '—';
      console.log(`  ${when}   ${a.sendAttemptResult}`);
    }
    console.log('');

    const ok = attempts.some((a) => String(a.sendAttemptResult) === 'SUCCESS');
    if (!ok) {
      console.error('⚠️ Доставка НЕ удалась. Что это значит:');
      console.error('  UNSUCCESSFUL_HTTP_RESPONSE_CODE  адрес ответил не 200 — смотри журнал функции');
      console.error('  NO_RESPONSE / TIMED_OUT          до функции не доехало вовсе');
      console.error('  TLS_ISSUE                        спор о сертификате');
      console.error('  INVALID_RESPONSE                 ответ не понравился Apple');
      process.exitCode = 1;
    }

    // Содержимое проверочного уведомления Apple отдаёт тут же. Прогоняем его
    // через НАШ проверяльщик подписи: так видно, что он согласен с Apple, а не
    // только что сеть доехала.
    if (status.signedPayload) {
      try {
        const parsed = await verifyAppleNotification(status.signedPayload);
        console.log('Наш проверяльщик подписи разобрал уведомление:');
        console.log(`  тип      ${parsed.notificationType}`);
        console.log(`  версия   ${parsed.version ?? '—'}`);
        console.log(`  метка    ${parsed.notificationUUID ?? '—'}`);
        console.log('');
        console.log('Это и есть доказательство: подпись Apple сходится нашим кодом.');
      } catch (error) {
        console.error('⚠️ Подпись НЕ сошлась нашим кодом:', error);
        console.error('Apple доставила уведомление, а разобрать его мы не смогли —');
        console.error('значит возвраты тоже отбрасывались бы. Это надо починить.');
        process.exitCode = 1;
      }
    }

    if (ok) {
      console.log('');
      console.log('Готово. В журнале функции должна стоять строка:');
      console.log('  [AppleNotify] Проверочное уведомление дошло, адрес настроен верно');
      console.log('');
      console.log('Посмотреть:');
      console.log('  firebase functions:log --only appleNotifications --project birklik-65289');
    }
    return;
  }

  console.error('Apple так и не сказала, чем кончилось. Метка проверки сохранена выше —');
  console.error('запрос о судьбе можно повторить позже тем же токеном.');
  process.exitCode = 1;
}

void main();
