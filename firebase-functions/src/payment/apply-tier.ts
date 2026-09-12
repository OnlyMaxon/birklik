import { admin } from '../firebase-admin';

/**
 * Применение оплаченного тарифа к объявлению.
 *
 * Вынесено из `azericardCallback` 2026-09-12, когда появилась вторая касса —
 * покупка через Google Play. Логика обязана быть одна: тариф, срок, статус и
 * гашение прежней даты это не «детали платежа», а состояние объявления. Две
 * копии разойдутся на первой же правке, и расхождение будет видно только как
 * «через банк продлилось, через приложение нет».
 *
 * Поэтому сюда не передаётся ничего про способ оплаты: ни подписи, ни чеки, ни
 * идентификаторы заказов. Кто и чем заплатил — забота вызывающей стороны, она же
 * и проверяет подлинность. Здесь только следствие.
 */

export type PaidTier = 'premium' | 'vip';
/** Длительность так и называется в записях платежей с 2025 года. */
export type TierDuration = '14days' | '30days';

/**
 * Дата окончания тарифа.
 *
 * Продление НЕ обнуляет остаток: если тариф ещё действует, новые дни
 * приписываются к его сроку, а не ко «сегодня». Иначе человек, продлевающий
 * заранее, терял бы оплаченное.
 */
function getExpiryDate(duration: string, currentExpiry?: string): string {
  const days = duration === '14days' ? 14 : 30;
  let base = new Date();

  if (currentExpiry) {
    // Даты лежат в двух видах: 'YYYY-MM-DD' у записей от банка и полный ISO из
    // редактора модератора. Короткую форму дотягиваем до конца дня, иначе
    // последний оплаченный день пропадал бы.
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(currentExpiry)
      ? `${currentExpiry}T23:59:59.999Z`
      : currentExpiry;
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now()) {
      base = parsed;
    }
  }

  const d = new Date(base);
  d.setDate(d.getDate() + days);
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Ставит объявлению оплаченный тариф и возвращает его на витрину.
 *
 * Вызывать ТОЛЬКО после того, как оплата подтверждена: подписью Azericard или
 * ответом Google Play. Проверки платежа здесь нет намеренно — у двух касс она
 * разная, а последствие одно.
 *
 * @returns дата окончания тарифа и статус, в который ушло объявление.
 */
export async function applyPaidTier(params: {
  propertyId: string;
  tier: PaidTier;
  duration: string;
}): Promise<{ expiryDate: string; status: 'active' | 'pending' }> {
  const { propertyId, tier, duration } = params;

  const propertyRef = admin.firestore().collection('properties').doc(propertyId);
  const propertySnap = await propertyRef.get();

  const currentExpiry = tier === 'premium'
    ? (propertySnap.data()?.premiumExpiresAt as string | undefined)
    : (propertySnap.data()?.vipExpiresAt as string | undefined);
  const expiryDate = getExpiryDate(duration, currentExpiry);

  // Куда объявление попадает после оплаты — решает его нынешний статус, а не
  // флаг isUpgrade, посчитанный ещё до перехода в банк.
  //
  // `active` и `inactive` означают, что модерацию оно уже проходило: первое
  // сейчас на витрине, второе скрыто из-за истёкшего тарифа. Содержимое с тех
  // пор не менялось, поэтому продление возвращает объявление на витрину сразу.
  // Черновик оплачен впервые — ему модерация нужна. Неизвестный статус тоже
  // отправляем на проверку: ошибиться в сторону модерации безопаснее.
  const currentStatus = propertySnap.data()?.status;
  const status = currentStatus === 'active' || currentStatus === 'inactive'
    ? 'active'
    : 'pending';

  await propertyRef.update({
    status,
    // Отметка о моменте скрытия больше не нужна — объявление вернулось.
    expiredAt: '',
    listingTier: tier,
    // Дата прежнего тарифа стирается. Иначе она остаётся в документе и
    // продолжает влиять: значок и место в выдаче смотрят именно на дату.
    ...(tier === 'premium'
      ? { isFeatured: true, premiumExpiresAt: expiryDate, vipExpiresAt: '' }
      : { isFeatured: false, vipExpiresAt: expiryDate, premiumExpiresAt: '' }),
  });

  return { expiryDate, status };
}
