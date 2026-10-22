import * as functions from 'firebase-functions/v1';
import {admin} from '../firebase-admin';

import {applyAppleRefund} from './apple-refunds';
import {AppleVerificationError, verifyAppleNotification, verifyAppleTransaction} from './app-store';

/**
 * Уведомления App Store — прежде всего о ВОЗВРАТАХ.
 *
 * ⚠️ **Возврат — это не наша кнопка и никогда ею не был.** Человек жалуется не
 * нам, а Apple; Apple возвращает деньги САМА, нас не спрашивая, и только
 * сообщает об этом сюда. У Apple такое случается заметно чаще, чем у Google.
 *
 * Чем это опасно без обработки: 2026-10-15 обнаружилось, что возврат **не
 * забирал оплаченное** — ни по карте, ни в Play. Деньги уходили обратно
 * покупателю, а Premium у объявления оставался висеть. Снаружи не видно вовсе:
 * покупатель доволен, объявление наверху, платит площадка. Дыра жила с первого
 * платного объявления.
 *
 * ⚠️ **У Google мы возвраты СПРАШИВАЕМ, у Apple их ПРИСЫЛАЮТ.** Это разные
 * механизмы, и подменить один другим нельзя: `syncPlayRefunds` ночью опрашивает
 * `voidedpurchases`, а Apple бьёт сюда уведомлением.
 *
 * Второй рубеж у Apple всё же есть — `syncAppleRefunds` ночью спрашивает
 * историю уведомлений через App Store Server API и догоняет то, что не доехало.
 * Разбор у обоих путей ОБЩИЙ, в `apple-refunds.ts`: двух реализаций у одного
 * события быть не должно.
 *
 * ⚠️ **Подпись — это вся проверка подлинности.** Адрес открыт, секрета в нём
 * нет и быть не может: Apple такого не предусматривает. Ровно так же устроен
 * колбэк Azericard, где подлинность доказывает `P_SIGN`.
 *
 * Адрес для App Store Connect (его надо указать ОТДЕЛЬНО для боевой среды и
 * отдельно для песочницы):
 * `https://europe-west1-birklik-65289.cloudfunctions.net/appleNotifications`
 */

/**
 * ⚠️ Код ответа решает, повторит ли Apple.
 *
 * ```
 * 200  приняли — повторять не нужно, даже если уведомление нам не интересно
 * 400  подпись не сошлась — повтор ничего не изменит
 * 500  сломались МЫ — пусть присылает снова
 * ```
 *
 * Отвечать 500 на чужую беду значит получать одно и то же уведомление сутки;
 * отвечать 200 на свою — потерять возврат навсегда.
 */
export const appleNotifications = functions
  .region('europe-west1')
  .runWith({timeoutSeconds: 120})
  .https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('POST only');
      return;
    }

    const signedPayload = (req.body as {signedPayload?: unknown} | undefined)?.signedPayload;
    if (typeof signedPayload !== 'string' || !signedPayload) {
      console.error('[AppleNotify] Тело без signedPayload');
      res.status(400).send('Missing signedPayload');
      return;
    }

    let notification;
    try {
      notification = await verifyAppleNotification(signedPayload);
    } catch (error) {
      const retryable = error instanceof AppleVerificationError && error.kind === 'unavailable';
      console.error('[AppleNotify] Уведомление отвергнуто:', error);
      // Не сошлась подпись — дело не в нас, повтор не поможет. Не дозвонились
      // до Apple за проверкой отзыва сертификата — пусть пришлёт снова.
      res.status(retryable ? 500 : 400).send('Verification failed');
      return;
    }

    const type = notification.notificationType;
    const uuid = notification.notificationUUID ?? '';

    // Проверочное уведомление из App Store Connect. Нужно, чтобы убедиться, что
    // адрес вообще настроен и доезжает.
    if (type === 'TEST') {
      console.log('[AppleNotify] Проверочное уведомление дошло, адрес настроен верно');
      res.status(200).send('OK');
      return;
    }

    // ⚠️ Чужие типы отвечают 200, а не отказом. У Apple их два десятка, почти
    // все про подписки, которых у нас нет вовсе. Отказ заставил бы её
    // присылать подписочный мусор сутками.
    if (type !== 'REFUND' && type !== 'REFUND_REVERSED' && type !== 'CONSUMPTION_REQUEST') {
      console.log('[AppleNotify] Тип не про нас, пропускаем:', type);
      res.status(200).send('OK');
      return;
    }

    const signedTransaction = notification.data?.signedTransactionInfo;
    if (!signedTransaction) {
      console.warn('[AppleNotify] В уведомлении нет покупки:', type, uuid);
      res.status(200).send('OK');
      return;
    }

    // Вложенная квитанция подписана ОТДЕЛЬНО, и её подпись тоже надо проверить:
    // доверять содержимому только потому, что внешний конверт подписан, нельзя.
    let tx;
    try {
      tx = await verifyAppleTransaction(signedTransaction);
    } catch (error) {
      console.error('[AppleNotify] Подпись вложенной квитанции не сошлась:', error);
      res.status(400).send('Bad transaction');
      return;
    }

    const db = admin.firestore();
    const claimRef = db.collection('applePurchases').doc(tx.transactionId);

    try {
      // Apple спрашивает, израсходован ли товар, чтобы решить судьбу возврата.
      // ⚠️ Ответить на такой запрос нельзя без ключа In-App Purchase: ответ
      // отправляется через App Store Server API. Пока ключа нет, Apple решает
      // без нас — записываем, чтобы это было видно, а не выглядело молчанием.
      if (type === 'CONSUMPTION_REQUEST') {
        console.warn(
          '[AppleNotify] Apple просит данные о расходе товара, а ответить нечем ' +
          '(нет ключа In-App Purchase). Решение о возврате примут без нас:',
          tx.transactionId
        );
        await claimRef.set({consumptionRequestedAt: new Date().toISOString()}, {merge: true});
        res.status(200).send('OK');
        return;
      }

      if (type === 'REFUND_REVERSED') {
        // Возврат отменили — покупка снова действительна. Сами НЕ возвращаем
        // оплаченное намеренно: `applyPaidTier` отсчитала бы срок от сегодня, то
        // есть выдала бы больше, чем человек купил. Случай редкий, разбирать его
        // должен человек, а не догадка в коде.
        console.error(
          '[AppleNotify] ВОЗВРАТ ОТМЕНЁН Apple — надо вернуть оплаченное РУКАМИ:',
          tx.transactionId, tx.productId
        );
        await claimRef.set(
          {refundReversedAt: new Date().toISOString(), needsManualRestore: true},
          {merge: true}
        );
        res.status(200).send('OK');
        return;
      }

      // Дальше только REFUND. Сам разбор — в `apple-refunds.ts`: тем же кодом
      // пользуется ночной опрос, и двух реализаций у одного события быть не
      // должно.
      const outcome = await applyAppleRefund(tx, 'уведомление');
      if (uuid) await claimRef.set({notificationUUID: uuid}, {merge: true});

      console.log(`[AppleNotify] Возврат ${tx.transactionId}: ${outcome.status}, ${outcome.detail}`);
      res.status(200).send('OK');
    } catch (error) {
      // Сломались МЫ: пусть Apple пришлёт снова, иначе возврат потеряется и
      // оплаченное останется у человека, которому вернули деньги.
      console.error('[AppleNotify] Обработка возврата упала, просим повтор:', error);
      res.status(500).send('Retry');
    }
  });
