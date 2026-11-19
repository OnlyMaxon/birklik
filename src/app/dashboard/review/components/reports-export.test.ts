import {describe, expect, it} from 'vitest'
import ru from '@birklik/core/messages/ru/app.json'
import type {Booking, MonthlyRevenue, Property, Translations} from '@birklik/core/types'
import type {UserRecord} from '@/services/user-service'
import {buildMonthReport, type ReportSources} from './reports-data'
import {reportSheets, type ReportExportDeps} from './reports-export'

/**
 * Проверки выгрузки отчёта в Excel.
 *
 * Здесь проверяется РАСКЛАДКА книги — что на каком листе и в каком столбце.
 * Сами байты файла проверяет `xlsx.test.ts`.
 */

/** Словарь лежит под ключом `App` — как его берут и сайт, и приложение. */
const t = (ru as {App: Translations}).App

const user = (over: Partial<UserRecord> = {}): UserRecord => ({
  id: 'u1',
  name: 'Xəyal Əliyev',
  email: 'xeyal@birklik.az',
  phone: '+994501234567',
  createdAt: '2026-11-17T09:00:00.000Z',
  ...over
} as UserRecord)

const booking = (over: Partial<Booking> = {}): Booking => ({
  id: 'b1',
  propertyId: 'p1',
  userName: 'Elgün Yolcuyev',
  userPhone: '+994551112233',
  userEmail: 'elgun@birklik.az',
  checkInDate: '2026-11-23T00:00:00.000Z',
  checkOutDate: '2026-11-25T00:00:00.000Z',
  nights: 2,
  totalPrice: 340,
  status: 'approved',
  createdAt: '2026-11-13T10:00:00.000Z',
  ...over
} as Booking)

const listing = (over: Partial<Property> = {}): Property => ({
  id: 'p1',
  title: {az: 'Home Rent', en: 'Home Rent', ru: 'Home Rent'},
  listingTier: 'vip',
  owner: {name: 'Babək Quliyev'},
  createdAt: '2026-11-05T08:00:00.000Z',
  ...over
} as Property)

const revenue = (over: Partial<MonthlyRevenue> = {}): MonthlyRevenue => ({
  month: '2026-11',
  grossAzn: 75,
  count: 3,
  refundedAzn: 10,
  refundCount: 1,
  byProviderAzn: {azericard: 55, app_store: 20, google_play: 0},
  countByProvider: {azericard: 2, app_store: 1, google_play: 0},
  byKindAzn: {tier: 60, boost: 15},
  ...over
} as MonthlyRevenue)

const deps = (over: Partial<ReportExportDeps> = {}): ReportExportDeps => ({
  t,
  listingTitle: () => 'Home Rent',
  ownerName: () => 'Babək Quliyev',
  bookingStatusLabel: status => (status === 'approved' ? 'Подтверждено' : status),
  getLocalizedText: value => value.ru || value.az || '',
  revenueFailed: false,
  undated: {users: 0, bookings: 0, listings: 0},
  generatedAt: new Date('2026-11-19T04:54:09.000Z'),
  ...over
})

function sheets(sources: Partial<ReportSources> = {}, over: Partial<ReportExportDeps> = {}) {
  const full: ReportSources = {users: [], bookings: [], listings: [], revenue: [], ...sources}
  return reportSheets(buildMonthReport('2026-11', full), deps(over))
}

const byName = (list: ReturnType<typeof sheets>, name: string) => {
  const found = list.find(sheet => sheet.name === name)
  if (!found) throw new Error(`нет листа «${name}»`)
  return found
}

describe('раскладка книги', () => {
  it('всегда пять листов, по разделу на каждый', () => {
    // Плавающее число листов заставляло бы искать, есть ли раздел вообще.
    expect(sheets().map(sheet => sheet.name)).toEqual([
      'Сводка за месяц',
      'Регистрации',
      'Бронирования',
      'Новые объявления',
      'Оплаты'
    ])
  })

  it('пустые листы остаются на месте и объясняют пустоту', () => {
    expect(byName(sheets(), 'Регистрации').rows).toHaveLength(0)
    expect(byName(sheets(), 'Регистрации').notes).toEqual([t.moderation.reportsEmpty])
  })

  it('у каждого листа ширина задана ровно на число его столбцов', () => {
    // Разойдутся — последние столбцы останутся узкими, и даты покажутся как
    // ########. Ровно это и было в CSV, где ширины нет вовсе.
    sheets({users: [user()], bookings: [booking()], listings: [listing()], revenue: [revenue()]})
      .forEach(sheet => {
        if (sheet.head) expect(sheet.widths).toHaveLength(sheet.head.length)
        sheet.rows.forEach(row => expect(row.length).toBeLessThanOrEqual(sheet.widths.length))
      })
  })
})

describe('сводка', () => {
  it('ставит в заголовок название площадки и месяц словами', () => {
    expect(byName(sheets(), 'Сводка за месяц').title).toBe('Birklik.az — Отчёты: Ноябрь 2026')
  })

  it('считает по тем же данным, что и плитки на экране', () => {
    const summary = byName(sheets({users: [user(), user({id: 'u2'})], bookings: [booking()]}), 'Сводка за месяц')
    expect(summary.rows[0]).toEqual([{kind: 'label', value: 'Регистрации'}, {kind: 'number', value: 2}])
    expect(summary.rows[1]).toEqual([{kind: 'label', value: 'Бронирования'}, {kind: 'number', value: 1}])
    expect(summary.rows[2]).toEqual([{kind: 'text', value: 'Сумма'}, {kind: 'money', value: 340}])
  })

  it('оговорку про брутто несёт всегда', () => {
    // Её увидит тот, кто вкладку не открывал; без неё итог выглядит
    // окончательным, а он до удержаний Apple и Google.
    expect(byName(sheets(), 'Сводка за месяц').notes?.[0]).toContain('Суммы')
  })

  it('о записях без даты говорит, а не молчит', () => {
    const notes = byName(sheets({}, {undated: {users: 1, bookings: 0, listings: 2}}), 'Сводка за месяц').notes
    expect(notes?.join(' ')).toContain('3')
  })

  it('без записей без даты лишней оговорки не пишет', () => {
    expect(byName(sheets(), 'Сводка за месяц').notes).toHaveLength(1)
  })
})

describe('брони', () => {
  it('заезд и выезд — ДВА столбца настоящих дат, а не одна строка', () => {
    // В CSV это был текст «23.11.2026 — 25.11.2026», и отобрать брони по дате
    // заезда было нельзя.
    const sheet = byName(sheets({bookings: [booking()]}), 'Бронирования')
    expect(sheet.head).toContain('Заезд')
    expect(sheet.head).toContain('Выезд')
    expect(sheet.rows[0][3]).toEqual({kind: 'date', value: '2026-11-23T00:00:00.000Z'})
    expect(sheet.rows[0][4]).toEqual({kind: 'date', value: '2026-11-25T00:00:00.000Z'})
  })

  it('сумму кладёт деньгами, а статус берёт у модераторки', () => {
    const row = byName(sheets({bookings: [booking()]}), 'Бронирования').rows[0]
    expect(row[6]).toEqual({kind: 'money', value: 340})
    expect(row[7]).toEqual({kind: 'text', value: 'Подтверждено'})
  })

  it('бронь без числа ночей оставляет ячейку пустой, а не нулём', () => {
    const row = byName(sheets({bookings: [booking({nights: undefined})]}), 'Бронирования').rows[0]
    expect(row[5]).toEqual({kind: 'blank'})
  })
})

describe('регистрации', () => {
  it('помечает заблокированных', () => {
    const row = byName(sheets({users: [user({blocked: true} as Partial<UserRecord>)]}), 'Регистрации').rows[0]
    expect(row[0]).toEqual({kind: 'text', value: 'Xəyal Əliyev (заблокирован)'})
  })

  it('почту и телефон сводит в один столбец контактов', () => {
    const row = byName(sheets({users: [user()]}), 'Регистрации').rows[0]
    expect(row[1]).toEqual({kind: 'text', value: 'xeyal@birklik.az · +994501234567'})
  })
})

describe('оплаты', () => {
  it('за пустой месяц отличает «покупок не было» от «не прочиталось»', () => {
    // Выглядят одинаково, а значат разное: во втором случае деньги могли быть.
    expect(byName(sheets(), 'Оплаты').notes).toEqual([t.moderation.revenueEmpty])
    expect(byName(sheets({}, {revenueFailed: true}), 'Оплаты').notes).toEqual([t.moderation.loadFailed])
  })

  it('разбивает по магазинам и по видам, и считает чистую сумму', () => {
    const rows = byName(sheets({revenue: [revenue()]}), 'Оплаты').rows
    expect(rows).toHaveLength(7)
    expect(rows[6][1]).toEqual({kind: 'money', value: 65}) // 75 брутто минус 10 возврата
  })

  it('курс и оговорки по видам сумм кладёт под таблицу', () => {
    const notes = byName(sheets({revenue: [revenue({usdRate: 1.7, estimatedCount: 2})]}), 'Оплаты').notes ?? []
    expect(notes.join(' ')).toContain('1 $ = 1.7 ₼')
    expect(notes.join(' ')).toContain('2')
  })
})

describe('объявления', () => {
  it('берёт тариф, ВЫБРАННЫЙ при размещении', () => {
    // Действующий мог с тех пор истечь, и отчёт за прошлый месяц показал бы
    // обычное объявление там, где за VIP заплатили.
    const row = byName(sheets({listings: [listing()]}), 'Новые объявления').rows[0]
    expect(row[1]).toEqual({kind: 'text', value: 'VIP'})
  })

  it('объявление без названия подписывает его номером', () => {
    const row = byName(sheets({listings: [listing({title: {az: '', en: ''}})]}), 'Новые объявления').rows[0]
    expect(row[0]).toEqual({kind: 'text', value: 'p1'})
  })
})
