import {
  AppStoreServerAPIClient,
  Environment,
  NotificationTypeV2,
} from '@apple/app-store-server-library';

import {APPLE_BUNDLE_ID, verifyAppleNotification, verifyAppleTransaction} from './app-store';
import {applyAppleRefund} from './apple-refunds';

/**
 * Ночной опрос возвратов App Store — ВТОРОЙ рубеж.
 *
 * ⚠️ Первый рубеж — уведомления (`appleNotifications`), и его одного мало.
 * Уведомление это сеть: наша функция лежала, Apple повторила несколько раз и
 * сдалась — возврат потерян навсегда. Деньги у покупателя, Premium на
 * объявлении, платит площадка, и снаружи этого не видно ВООБЩЕ. Такая дыра уже
 * жила у нас с первого платного объявления.
 *
 * Поэтому раз в сутки спрашиваем у Apple сами: «что ты мне присылала за
 * последнюю неделю». Ответ приходит теми же подписанными уведомлениями, и
 * разбирает их тот же `applyAppleRefund` — двух реализаций у одного события
 * быть не должно.
 *
 * ⚠️ В отличие от первого рубежа, этому НУЖЕН ключ In-App Purchase: запрос к
 * App Store Server API подписывается им. Нет ключа — задача честно пишет об
 * этом в журнал и выходит, а не падает: иначе упавшее расписание утащило бы за
 * собой и другие ночные задачи.
 */

/** Сколько дней назад смотреть. То же окно, что у Google. */
const LOOKBACK_DAYS = 7;

/**
 * Предел страниц. У Apple их по 20 записей; сто уведомлений о возвратах за
 * неделю означали бы, что случилось что-то куда интереснее опроса.
 */
const MAX_PAGES = 20;

export interface AppleRefundSyncResult {
  seen: number;
  revoked: number;
  already: number;
  unknown: number;
}

/**
 * Клиент App Store Server API.
 *
 * ⚠️ Среда — только боевая. В песочнице возвраты тоже бывают (их делаем мы
 * сами при проверке), но денег там нет, и отбирать по ним тариф незачем.
 */
function makeClient(): AppStoreServerAPIClient | null {
  const issuerId = process.env.APPLE_ISSUER_ID?.trim();
  const keyId = process.env.APPLE_KEY_ID?.trim();
  // ⚠️ Ключ в переменной окружения приезжает с `\n` ЭКРАНИРОВАННЫМИ — так его
  // туда кладут. Не развернёшь обратно — библиотека не разберёт PEM и скажет
  // что-то про неверный формат ключа, а не про перенос строки.
  const privateKey = process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();

  if (!issuerId || !keyId || !privateKey) {
    return null;
  }

  return new AppStoreServerAPIClient(
    privateKey,
    keyId,
    issuerId,
    APPLE_BUNDLE_ID,
    Environment.PRODUCTION
  );
}

export async function syncAppleRefunds(): Promise<AppleRefundSyncResult> {
  const result: AppleRefundSyncResult = {seen: 0, revoked: 0, already: 0, unknown: 0};

  const client = makeClient();
  if (!client) {
    console.warn(
      '[AppleSync] Пропущено: нет APPLE_ISSUER_ID, APPLE_KEY_ID или APPLE_PRIVATE_KEY. ' +
      'Пока их нет, возвраты держатся на одних уведомлениях — не доехавшее мы не увидим.'
    );
    return result;
  }

  const endDate = Date.now();
  const startDate = endDate - LOOKBACK_DAYS * 86400000;

  let paginationToken: string | null = null;
  let page = 0;

  do {
    let response;
    try {
      response = await client.getNotificationHistory(paginationToken, {
        startDate,
        endDate,
        notificationType: NotificationTypeV2.REFUND,
      });
    } catch (error) {
      // До Apple не дошли. Завтра спросим снова — окно в неделю это покрывает.
      console.error('[AppleSync] Запрос истории уведомлений не удался:', error);
      return result;
    }

    for (const item of response.notificationHistory ?? []) {
      if (!item.signedPayload) continue;
      result.seen += 1;

      try {
        // ⚠️ Подпись проверяем ЗАНОВО, хотя запись пришла от самой Apple по
        // подписанному ключом запросу. Это дёшево и снимает целый класс
        // вопросов: разбор возврата обязан получать только проверенные данные,
        // откуда бы они ни приехали.
        const notification = await verifyAppleNotification(item.signedPayload);
        const signedTransaction = notification.data?.signedTransactionInfo;
        if (!signedTransaction) continue;

        const tx = await verifyAppleTransaction(signedTransaction);
        const outcome = await applyAppleRefund(tx, 'ночной опрос');

        if (outcome.status === 'revoked') result.revoked += 1;
        else if (outcome.status === 'already') result.already += 1;
        else if (outcome.status === 'unknown') result.unknown += 1;
      } catch (error) {
        // Одна плохая запись не должна останавливать разбор остальных.
        console.error('[AppleSync] Запись истории разобрать не удалось:', error);
      }
    }

    paginationToken = response.hasMore ? response.paginationToken ?? null : null;
    page += 1;
  } while (paginationToken && page < MAX_PAGES);

  if (page >= MAX_PAGES && paginationToken) {
    console.error('[AppleSync] Упёрлись в предел страниц — часть возвратов не разобрана');
  }

  console.log(
    `[AppleSync] Возвратов за ${LOOKBACK_DAYS} дней: ${result.seen}, ` +
    `отобрано ${result.revoked}, уже было ${result.already}, неизвестных ${result.unknown}`
  );

  return result;
}
