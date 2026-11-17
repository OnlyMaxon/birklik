import {describe, expect, it} from 'vitest'
import type {Booking, Property, MonthlyRevenue} from '@birklik/core/types'
import type {UserRecord} from '@/services/user-service'
import {buildMonthReport, reportMonths, undatedCounts, type ReportSources} from './reports-data'

const user = (id: string, createdAt?: string): UserRecord =>
  ({id, name: `Имя ${id}`, email: `${id}@mail.az`, phone: '+994', createdAt: createdAt as string})

const booking = (id: string, createdAt: string | undefined, totalPrice: number): Booking =>
  ({
    id,
    propertyId: 'p1',
    userId: 'u1',
    ownerId: 'o1',
    userName: 'Гость',
    userEmail: 'g@mail.az',
    userPhone: '+994',
    checkInDate: '2026-11-10',
    checkOutDate: '2026-11-12',
    nights: 2,
    totalPrice,
    createdAt: createdAt as string,
    status: 'pending'
  })

const listing = (id: string, createdAt: string | undefined, tier?: string): Property =>
  ({
    id,
    createdAt,
    listingTier: tier,
    title: {az: id, en: id}
  } as unknown as Property)

const month = (name: string, grossAzn: number): MonthlyRevenue => ({month: name, grossAzn})

const sources = (overrides: Partial<ReportSources> = {}): ReportSources => ({
  users: [],
  bookings: [],
  listings: [],
  revenue: [],
  ...overrides
})

describe('reportMonths', () => {
  it('складывает месяцы из всех четырёх источников, свежий первым', () => {
    const list = reportMonths(sources({
      users: [user('u1', '2026-09-05T10:00:00.000Z')],
      bookings: [booking('b1', '2026-11-02T10:00:00.000Z', 100)],
      listings: [listing('l1', '2026-10-20T10:00:00.000Z')],
      revenue: [month('2026-08', 55)]
    }))
    expect(list).toEqual(['2026-11', '2026-10', '2026-09', '2026-08'])
  })

  it('оставляет месяц оплат, даже если своих регистраций и броней у него нет', () => {
    // Деньги за месяц пришли — отчёт о нём обязан существовать.
    expect(reportMonths(sources({revenue: [month('2026-07', 30)]}))).toEqual(['2026-07'])
  })

  it('относит запись к БАКИНСКОМУ месяцу, а не к UTC', () => {
    // 30 ноября 22:00 UTC — это 1 декабря 02:00 в Баку. Счётчик оплат на
    // сервере считает так же, и отчёт обязан с ним совпасть.
    expect(reportMonths(sources({users: [user('u1', '2026-11-30T22:00:00.000Z')]}))).toEqual(['2026-12'])
  })

  it('не выдумывает месяц записи без даты', () => {
    expect(reportMonths(sources({users: [user('u1', undefined)]}))).toEqual([])
  })
})

describe('undatedCounts', () => {
  it('считает записи без даты по каждому источнику', () => {
    // Такие в боевой базе есть, и они не попадают ни в один месяц. Без этого
    // числа сумма месяцев молча не сошлась бы с соседними вкладками.
    const counts = undatedCounts(sources({
      users: [user('u1', undefined), user('u2', '2026-11-01T10:00:00.000Z')],
      bookings: [booking('b1', undefined, 100)],
      listings: [listing('l1', '2026-11-01T10:00:00.000Z')]
    }))
    expect(counts).toEqual({users: 1, bookings: 1, listings: 0})
  })
})

describe('buildMonthReport', () => {
  it('берёт только записи выбранного месяца', () => {
    const report = buildMonthReport('2026-11', sources({
      users: [user('u1', '2026-11-05T10:00:00.000Z'), user('u2', '2026-10-05T10:00:00.000Z')],
      bookings: [booking('b1', '2026-11-05T10:00:00.000Z', 120), booking('b2', '2026-10-05T10:00:00.000Z', 300)],
      listings: [listing('l1', '2026-11-05T10:00:00.000Z'), listing('l2', '2026-12-05T10:00:00.000Z')]
    }))
    expect(report.users.map(person => person.id)).toEqual(['u1'])
    expect(report.bookings.map(item => item.id)).toEqual(['b1'])
    expect(report.listings.map(item => item.id)).toEqual(['l1'])
  })

  it('суммирует брони месяца', () => {
    const report = buildMonthReport('2026-11', sources({
      bookings: [
        booking('b1', '2026-11-05T10:00:00.000Z', 120),
        booking('b2', '2026-11-09T10:00:00.000Z', 80.5),
        booking('b3', '2026-10-09T10:00:00.000Z', 999)
      ]
    }))
    expect(report.bookingsSum).toBe(200.5)
  })

  it('раскладывает объявления по тарифам', () => {
    const report = buildMonthReport('2026-11', sources({
      listings: [
        listing('l1', '2026-11-01T10:00:00.000Z', 'premium'),
        listing('l2', '2026-11-02T10:00:00.000Z', 'vip'),
        listing('l3', '2026-11-03T10:00:00.000Z', 'standard'),
        listing('l4', '2026-11-04T10:00:00.000Z')
      ]
    }))
    // Объявление без тарифа — обычное: по умолчанию размещение бесплатное, и
    // так его считает весь остальной код.
    expect(report.byTier).toEqual({standard: 2, vip: 1, premium: 1})
  })

  it('подхватывает месяц оплат и молчит, когда покупок не было', () => {
    const withPayments = buildMonthReport('2026-11', sources({revenue: [month('2026-11', 85)]}))
    expect(withPayments.revenue?.grossAzn).toBe(85)
    const without = buildMonthReport('2026-10', sources({revenue: [month('2026-11', 85)]}))
    expect(without.revenue).toBeUndefined()
  })

  it('сортирует списки свежим сверху', () => {
    const report = buildMonthReport('2026-11', sources({
      users: [user('старый', '2026-11-01T10:00:00.000Z'), user('новый', '2026-11-20T10:00:00.000Z')]
    }))
    expect(report.users.map(person => person.id)).toEqual(['новый', 'старый'])
  })
})
