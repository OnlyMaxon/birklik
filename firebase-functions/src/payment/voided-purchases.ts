import {admin} from '../firebase-admin';

import {revokeBoostPackage} from '../boost/apply-boost';
import {revokePaidTier} from './apply-tier';
import {listVoidedPurchases, VOIDED_REASONS, VOIDED_SOURCES} from './google-play';

/**
 * Сверка возвратов Google Play.
 *
 * ⚠️ **Зачем это существует.** Про возврат денег Google нам не сообщает ничем:
 * покупка просто перестаёт быть действительной, а тариф или подъём у нас уже
 * стоят. До 2026-10-15 таких сведений в системе не было вовсе — ни опроса, ни
 * подписки на уведомления, — то есть человек возвращал деньги и **оставлял себе
 * оплаченное**. Убыток тихий: покупатель доволен, жалоб нет, в журнале порядок.
 * Именно поэтому его легко не замечать годами.
 *
 * Та же дыра была и у второй кассы: возврат по карте метил платёж `reversed` и
 * объявление не трогал. Закрыты обе одновременно и одними функциями отзыва —
 * `revokePaidTier` и `revokeBoostPackage`.
 *
 * ```
 * раз в сутки   спрашиваем у Google отменённые покупки за последнюю неделю
 * по каждой     находим запись чека, забираем оплаченное, метим чек и платёж
 * повторно      не трогаем: отметка `voided` на записи чека делает прогон
 *               безопасным для повторов
 * ```
 *
 * ⚠️ Запас в неделю при суточном прогоне — намеренный. Пропущенный прогон (сбой
 * функции, выкладка, лимит) иначе означал бы безвозвратно пропущенный возврат:
 * Google хранит отменённые покупки около тридцати дней и потерянного не
 * догнать. Повторная обработка ничего не портит, пропущенная — да.
 */

/** Сколько назад смотреть при каждом прогоне. Запас на пропущенные прогоны. */
const LOOKBACK_DAYS = 7;

export interface VoidedSyncResult {
  /** Сколько отменённых покупок вернул Google. */
  seen: number;
  /** По скольким забрали оплаченное. */
  revoked: number;
  /** Сколько уже были разобраны прошлым прогоном. */
  known: number;
  /** Сколько Google назвал, а у нас записи чека нет — повод смотреть глазами. */
  unknown: number;
}

export async function syncVoidedPurchases(): Promise<VoidedSyncResult> {
  const db = admin.firestore();
  const since = Date.now() - LOOKBACK_DAYS * 86400000;

  const voided = await listVoidedPurchases(since);
  const result: VoidedSyncResult = {seen: voided.length, revoked: 0, known: 0, unknown: 0};

  if (voided.length === 0) {
    console.log('[Voided] Возвратов за последние', LOOKBACK_DAYS, 'дней нет');
    return result;
  }

  for (const item of voided) {
    const why =
      `${VOIDED_SOURCES[item.voidedSource ?? -1] ?? 'источник неизвестен'}` +
      `, ${VOIDED_REASONS[item.voidedReason ?? -1] ?? 'причина неизвестна'}`;

    const claimRef = db.collection('playPurchases').doc(item.purchaseToken);
    const claim = await claimRef.get();

    if (!claim.exists) {
      // Google знает о покупке, а мы её никогда не применяли. Бывает законно:
      // человек купил, приложение умерло до проверки чека, и покупку вернули
      // автоматически через три дня — как раз та страховка, на которой держится
      // порядок расхода товара. Записываем в журнал и идём дальше.
      result.unknown += 1;
      console.warn(
        `[Voided] Возврат по неизвестному нам чеку: заказ ${item.orderId ?? '—'} (${why})`
      );
      continue;
    }

    const data = claim.data() ?? {};

    if (data.voided === true) {
      result.known += 1;
      continue;
    }

    const propertyId = data.propertyId as string | undefined;
    // Чек занят, но оплаченное не выдавалось — забирать нечего, только метим.
    const wasApplied =
      data.applied === true || Boolean(data.expiryDate) || Boolean(data.boostedAt);

    let revokeResult = 'выдать не успели — забирать нечего';

    if (wasApplied && propertyId) {
      if (data.kind === 'boost') {
        const taken = await revokeBoostPackage({
          propertyId,
          reason: `возврат Google Play, заказ ${item.orderId ?? '—'} (${why})`,
        });
        revokeResult = `подъём снят, отобрано ${taken}`;
      } else {
        const ok = await revokePaidTier({
          propertyId,
          reason: `возврат Google Play, заказ ${item.orderId ?? '—'} (${why})`,
        });
        revokeResult = ok ? 'тариф снят' : 'объявления уже нет';
      }
      result.revoked += 1;
    }

    await claimRef.update({
      voided: true,
      voidedAt: item.voidedTimeMillis
        ? new Date(Number(item.voidedTimeMillis)).toISOString()
        : new Date().toISOString(),
      voidedReason: why,
      revokeResult,
    });

    // Тот же след в общем журнале платежей: выручку считают по нему, и
    // возвращённая покупка не должна в ней остаться.
    const payments = await db
      .collection('payments')
      .where('purchaseToken', '==', item.purchaseToken)
      .limit(1)
      .get();

    if (!payments.empty) {
      await payments.docs[0].ref.update({
        status: 'reversed',
        reversedAt: admin.firestore.FieldValue.serverTimestamp(),
        voidedReason: why,
        revokeResult,
      });
    }

    console.log(
      `[Voided] Заказ ${item.orderId ?? '—'}: ${revokeResult} (${why}), объявление ${propertyId ?? '—'}`
    );
  }

  console.log(
    `[Voided] Итог: получено ${result.seen}, отозвано ${result.revoked}, ` +
      `уже разобрано ${result.known}, неизвестных ${result.unknown}`
  );

  return result;
}
