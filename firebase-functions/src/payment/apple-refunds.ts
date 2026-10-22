import {admin} from '../firebase-admin';

import {revokePaidTier} from './apply-tier';
import {revokeBoostPackage} from '../boost/apply-boost';
import type {AppleTransaction} from './app-store';

/**
 * Отзыв оплаченного при возврате денег Apple — ОДНА реализация на два пути.
 *
 * ⚠️ Путей к одному и тому же событию два, и это не дублирование, а страховка:
 *
 * ```
 * appleNotifications   Apple сама бьёт уведомлением, когда вернула деньги
 * syncAppleRefunds     ночью спрашиваем, что мы пропустили
 * ```
 *
 * Уведомление — это сеть. Не доехало (наша функция лежала, Apple сдалась после
 * повторов) — и возврат мы не увидим никогда: деньги у покупателя, Premium на
 * объявлении, платит площадка. Ровно такая дыра жила у нас с первого платного
 * объявления и закрылась только 2026-10-15.
 *
 * ⚠️ **Разбор обязан быть общим.** Напиши его дважды — и однажды правка ляжет в
 * один путь, а не в другой; какой из них сработал в конкретном случае, не видно
 * ниоткуда. У нас это уже было с комментариями, пока их не свели в
 * `interactions.ts`.
 */

/** Чем кончился разбор одного возврата. */
export interface RefundOutcome {
  status: 'revoked' | 'already' | 'unknown' | 'nothing-to-take';
  detail: string;
}

/**
 * Забирает выданное по возвращённой покупке.
 *
 * Идемпотентна: повторный вызов по той же покупке ничего не отнимает второй раз.
 * Это обязательно — Apple повторяет уведомления, пока не получит 200, а ночной
 * опрос видит те, что уже обработаны вебхуком.
 *
 * @param tx       разобранная и ПРОВЕРЕННАЯ квитанция
 * @param source   откуда пришло — попадёт в журнал, чтобы было видно, какой из
 *                 двух путей сработал
 */
export async function applyAppleRefund(
  tx: AppleTransaction,
  source: 'уведомление' | 'ночной опрос'
): Promise<RefundOutcome> {
  const db = admin.firestore();
  const claimRef = db.collection('applePurchases').doc(tx.transactionId);
  const claim = await claimRef.get();

  if (!claim.exists) {
    // Apple знает о покупке, а мы её никогда не применяли. Бывает законно:
    // человек купил, приложение умерло до проверки подписи, покупка осталась
    // неподтверждённой и её вернули — как раз та страховка, ради которой товар
    // подтверждается только после выдачи.
    return {status: 'unknown', detail: 'покупка нам неизвестна — выдавать было нечего'};
  }

  const data = claim.data() ?? {};

  if (data.voided === true) {
    return {status: 'already', detail: 'этот возврат уже обработан'};
  }

  const propertyId = data.propertyId as string | undefined;
  // Признак выданного — не сама запись, а СЛЕД выдачи: дата окончания у тарифа,
  // дата подъёма у подъёма.
  const wasApplied =
    data.applied === true || Boolean(data.expiryDate) || Boolean(data.boostedAt);

  let revokeResult = 'выдать не успели — забирать нечего';
  let status: RefundOutcome['status'] = 'nothing-to-take';

  if (wasApplied && propertyId) {
    const why = `возврат App Store (${source}), покупка ${tx.transactionId}`;
    if (data.kind === 'boost') {
      const taken = await revokeBoostPackage({propertyId, reason: why});
      revokeResult = `подъём снят, отобрано ${taken}`;
    } else {
      const ok = await revokePaidTier({propertyId, reason: why});
      revokeResult = ok ? 'тариф снят' : 'объявления уже нет';
    }
    status = 'revoked';
  }

  await claimRef.update({
    voided: true,
    voidedAt: new Date().toISOString(),
    voidedReason: `возврат App Store (${source})`,
    revokeResult,
  });

  // Тот же след в общем журнале платежей: выручку считают по нему, и
  // возвращённая покупка не должна в ней остаться.
  const payments = await db
    .collection('payments')
    .where('transactionId', '==', tx.transactionId)
    .limit(1)
    .get();

  if (!payments.empty) {
    await payments.docs[0].ref.update({
      status: 'reversed',
      reversedAt: new Date().toISOString(),
      reversedReason: `возврат App Store (${source})`,
    });
  }

  console.log(
    `[AppleRefund] ${tx.transactionId}, объявление ${propertyId ?? '—'}, ` +
    `${source}: ${revokeResult}`
  );

  return {status, detail: revokeResult};
}
