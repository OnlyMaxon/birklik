import {bakuMonth} from '@birklik/core/utils/months'
import type {Booking, MonthlyRevenue, Property} from '@birklik/core/types'
import type {UserRecord} from '@/services/user-service'

/**
 * Отчёт за месяц — чистая выборка из того, что модераторка уже загрузила.
 *
 * Новых запросов к Firestore нет и не нужно: страница модерации и так тянет
 * всех людей, все брони, все объявления и месяцы оплат одним `Promise.all`.
 * Отчёт — другой взгляд на те же данные, а не новый источник. Отсюда же и
 * отсутствие новых правил безопасности: читать разрешено ровно то же, что
 * читали вкладки рядом.
 *
 * Файл отделён от вида нарочно: раскладку по месяцам проверяют тесты, а на
 * JSX их не напишешь.
 */

export interface ReportSources {
  users: UserRecord[]
  bookings: Booking[]
  listings: Property[]
  revenue: MonthlyRevenue[]
}

/** Ступени, которые встречаются в боевой базе. `free` объявлен в типе, но не используется нигде. */
export type ReportTier = 'standard' | 'vip' | 'premium'

export interface MonthReport {
  month: string
  users: UserRecord[]
  bookings: Booking[]
  listings: Property[]
  byTier: Record<ReportTier, number>
  /** Сумма броней месяца, манаты. Это НЕ выручка площадки: платят хозяину, не нам. */
  bookingsSum: number
  /** Месяц оплат. `undefined` — в этом месяце покупок не было. */
  revenue?: MonthlyRevenue
}

/**
 * Записи без даты. Ни в один месяц они не попадают, и показать их число
 * обязательно: иначе сумма месяцев молча не сойдётся с общим количеством, как
 * это уже было с вкладкой «Пользователи», где `orderBy('createdAt')`
 * выбрасывал профиль без поля.
 */
export interface UndatedCounts {
  users: number
  bookings: number
  listings: number
}

/**
 * Тариф для отчёта.
 *
 * Берётся `listingTier` — ступень, ВЫБРАННАЯ при размещении, а не действующая
 * сейчас. Для отчёта за прошлый месяц это единственный честный ответ: срок
 * Premium с тех пор мог истечь, и «действующий» тариф показал бы обычное
 * объявление там, где за Premium заплатили.
 *
 * Отсутствие поля и неизвестное значение считаем обычным: по умолчанию
 * размещение бесплатное, и так его трактует весь остальной код.
 */
const tierOf = (listing: Property): ReportTier =>
  listing.listingTier === 'vip' || listing.listingTier === 'premium' ? listing.listingTier : 'standard'

/** Месяцы, за которые есть хоть что-то, свежий первым. */
export function reportMonths(sources: ReportSources): string[] {
  const months = new Set<string>()
  const add = (value?: string) => {
    const month = bakuMonth(value)
    if (month) months.add(month)
  }
  sources.users.forEach(user => add(user.createdAt))
  sources.bookings.forEach(booking => add(booking.createdAt))
  sources.listings.forEach(listing => add(listing.createdAt))
  // Месяц оплат добавляем даже без своих регистраций и броней: деньги за него
  // пришли, и отчёт о них обязан существовать.
  sources.revenue.forEach(month => months.add(month.month))
  return Array.from(months).sort((a, b) => b.localeCompare(a))
}

export function undatedCounts(sources: ReportSources): UndatedCounts {
  return {
    users: sources.users.filter(user => !bakuMonth(user.createdAt)).length,
    bookings: sources.bookings.filter(booking => !bakuMonth(booking.createdAt)).length,
    listings: sources.listings.filter(listing => !bakuMonth(listing.createdAt)).length
  }
}

export function buildMonthReport(month: string, sources: ReportSources): MonthReport {
  const inMonth = (value?: string) => bakuMonth(value) === month

  const users = sources.users
    .filter(user => inMonth(user.createdAt))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  const bookings = sources.bookings
    .filter(booking => inMonth(booking.createdAt))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  const listings = sources.listings
    .filter(listing => inMonth(listing.createdAt))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  const byTier: Record<ReportTier, number> = {standard: 0, vip: 0, premium: 0}
  listings.forEach(listing => {
    byTier[tierOf(listing)] += 1
  })

  return {
    month,
    users,
    bookings,
    listings,
    byTier,
    bookingsSum: bookings.reduce((sum, booking) => sum + (Number(booking.totalPrice) || 0), 0),
    revenue: sources.revenue.find(item => item.month === month)
  }
}

export {tierOf}
