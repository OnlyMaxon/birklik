/**
 * Тарифы объявления: единственное место, где решается «действует ли VIP/Premium».
 *
 * До этого ответ считался в четырёх местах по-разному, и каждое ошибалось в свою
 * сторону: карточка проверяла у Premium дату и не смотрела на тариф, у VIP —
 * наоборот. Отсюда бралось и то, что снятый тариф продолжал показывать значок,
 * и то, что «вечная корона» переживала оплаченный срок.
 */

import type {ListingTier} from '@/types'

interface TieredListing {
  listingTier?: ListingTier
  premiumExpiresAt?: string
  vipExpiresAt?: string
}

/**
 * Момент окончания срока в миллисекундах.
 *
 * Дата лежит в двух видах: `YYYY-MM-DD` у старых записей и полный ISO с
 * 23:59:59 из редактора модератора. `Date` разбирает оба, но date-only даёт
 * полночь UTC — значит последний оплаченный день считался бы прошедшим с самого
 * утра. Поэтому у короткой формы берём конец дня.
 */
function expiryTimestamp(value: string): number | null {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime()
}

/** Дата окончания текущего тарифа объявления, если тариф платный. */
export function tierExpiresAt(listing: TieredListing): string | undefined {
  if (listing.listingTier === 'vip') return listing.vipExpiresAt
  if (listing.listingTier === 'premium') return listing.premiumExpiresAt
  return undefined
}

/**
 * Действует ли у объявления именно этот платный тариф.
 *
 * Требуется и совпадение тарифа, и непросроченная дата. Платный тариф без даты
 * считается недействующим намеренно: такая запись сломана (дату ставит либо
 * колбэк банка, либо модератор), и показывать по ней значок значило бы раздавать
 * платное место даром.
 */
export function isTierActive(listing: TieredListing, tier: 'vip' | 'premium'): boolean {
  if (listing.listingTier !== tier) return false
  const raw = tier === 'vip' ? listing.vipExpiresAt : listing.premiumExpiresAt
  if (!raw) return false
  const expires = expiryTimestamp(raw)
  return expires !== null && expires > Date.now()
}

/** Тариф платный, но срок вышел — объявление ждёт продления. */
export function isTierExpired(listing: TieredListing): boolean {
  const tier = listing.listingTier
  if (tier !== 'vip' && tier !== 'premium') return false
  const raw = tierExpiresAt(listing)
  if (!raw) return true
  const expires = expiryTimestamp(raw)
  return expires === null || expires <= Date.now()
}

/**
 * Вес объявления в выдаче: Premium выше VIP, VIP выше обычного.
 * Истёкший платный тариф опускается к обычным.
 */
export function tierRank(listing: TieredListing): number {
  if (isTierActive(listing, 'premium')) return 3
  if (isTierActive(listing, 'vip')) return 2
  return 1
}

/**
 * Осталось дней до конца тарифа. Ноль, если срок вышел или даты нет.
 */
export function tierRemainingDays(listing: TieredListing): number {
  const raw = tierExpiresAt(listing)
  if (!raw) return 0
  const expires = expiryTimestamp(raw)
  if (expires === null || expires <= Date.now()) return 0
  return Math.ceil((expires - Date.now()) / (24 * 60 * 60 * 1000))
}
