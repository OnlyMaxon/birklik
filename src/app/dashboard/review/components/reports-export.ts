import type {Property, Translations} from '@birklik/core/types'
import {tierOf, type MonthReport, type UndatedCounts} from './reports-data'
import {monthLabel, money, PROVIDERS, providerLabel, tierLabel, TIERS} from './reports-labels'
import {blank, buildXlsx, date, downloadXlsx, label, money as moneyCell, number, text, type XlsxCell, type XlsxSheet} from './xlsx'

/**
 * Отчёт за месяц книгой Excel.
 *
 * ## Что здесь изменилось и почему
 *
 * Раньше это был CSV одной простынёй: сводка, люди, брони, объявления и оплаты
 * шли друг за другом в одной таблице, с разной шапкой у каждого куска. Владелец
 * сказал прямо — «интерфейс очень сложный, всё вместе, путаться можно сильно»,
 * и он прав: в одном листе столбец `C` означал пять разных вещей в пяти местах,
 * а ширину под даты CSV задать не умеет вовсе — оттого и `########`.
 *
 * Теперь **каждый раздел — свой лист**, и внутри листа столбец значит одно и то
 * же от шапки до низа. Разбор кракозябр — в шапке `xlsx.ts`.
 *
 * ⚠️ **Выгрузка всегда отдаёт месяц ЦЕЛИКОМ.** Плитки на вкладке фильтруют то,
 * что на экране, и к файлу отношения не имеют: это решение владельца от
 * 2026-11-19. Соблазн «выгружать выбранное» велик — не поддавайся, файл с
 * половиной отчёта и тем же именем не отличить от полного.
 *
 * ⚠️ **Листов всегда пять, даже когда раздел пуст.** Книга с плавающим числом
 * листов заставляет искать, а пустой лист с оговоркой «за этот месяц записей
 * нет» отвечает сразу.
 */

/** Ширины столбцов в знаках. Подобраны по самой длинной строке, какая реально встречается. */
const WIDTH = {
  summaryLabel: 32,
  summaryValue: 16,
  name: 26,
  contacts: 34,
  listing: 40,
  date: 13,
  nights: 9,
  sum: 14,
  status: 18,
  tier: 12,
  owner: 24,
  count: 12
}

export interface ReportExportDeps {
  t: Translations
  /** Название объявления по его номеру. Объявление могло быть удалено — тогда `—`. */
  listingTitle: (propertyId: string) => string
  ownerName: (listing: Property) => string
  /** Подписи статусов берём у модераторки: в файле и на экране они обязаны совпадать. */
  bookingStatusLabel: (status: string) => string
  getLocalizedText: (text: Partial<Record<'az' | 'en' | 'ru', string>>) => string
  /** Оплаты не прочитались. Пустой месяц и отказ выглядят одинаково, а значат разное. */
  revenueFailed: boolean
  undated: UndatedCounts
  /** Время составления. Отдельным доводом — чтобы тест не зависел от часов. */
  generatedAt: Date
}

/* -------------------------------------------------------------------------- */

function summarySheet(data: MonthReport, deps: ReportExportDeps): XlsxSheet {
  const {t} = deps
  const paid = data.revenue

  // Подписи разделов жирные, их составляющие — обычные. Так видно, что «VIP»
  // относится к «Новым объявлениям», и не нужны отступы пробелами, которые в
  // Excel разъезжаются при смене шрифта.
  const rows: XlsxCell[][] = [
    [label(t.moderation.reportsNewUsers), number(data.users.length)],
    [label(t.moderation.reportsBookings), number(data.bookings.length)],
    [text(t.moderation.reportsColSum), moneyCell(data.bookingsSum)],
    [label(t.moderation.reportsNewListings), number(data.listings.length)],
    ...TIERS.map(tier => [text(tierLabel(tier, t)), number(data.byTier[tier])]),
    [label(t.moderation.reportsPayments), moneyCell(paid?.grossAzn ?? 0)],
    [text(t.moderation.revenuePurchases), number(paid?.count ?? 0)],
    [blank, blank],
    [label(t.moderation.reportsGeneratedAt), date(deps.generatedAt.toISOString())]
  ]

  const notes = [t.moderation.revenueGrossNote]
  const undatedTotal = deps.undated.users + deps.undated.bookings + deps.undated.listings
  // Записи без даты ни в один месяц не попадают. Молчать о них нельзя: сумма
  // месяцев тогда не сойдётся с числом на соседних вкладках.
  if (undatedTotal > 0) {
    notes.push(t.moderation.reportsNoDateNote.replace('{count}', String(undatedTotal)))
  }

  return {
    name: t.moderation.reportsSummary,
    title: `Birklik.az — ${t.moderation.reportsTab}: ${monthLabel(data.month, t)}`,
    widths: [WIDTH.summaryLabel, WIDTH.summaryValue],
    rows,
    notes
  }
}

function usersSheet(data: MonthReport, deps: ReportExportDeps): XlsxSheet {
  const {t} = deps
  return {
    name: t.moderation.reportsNewUsers,
    widths: [WIDTH.name, WIDTH.contacts, WIDTH.date],
    head: [t.moderation.reportsColName, t.moderation.reportsColContacts, t.moderation.reportsColDate],
    rows: data.users.map(person => [
      text(person.blocked ? `${person.name || '—'} (${t.moderation.reportsBlocked})` : person.name || '—'),
      text([person.email, person.phone].filter(Boolean).join(' · ')),
      date(person.createdAt)
    ]),
    notes: data.users.length === 0 ? [t.moderation.reportsEmpty] : undefined
  }
}

function bookingsSheet(data: MonthReport, deps: ReportExportDeps): XlsxSheet {
  const {t} = deps
  return {
    name: t.moderation.reportsBookings,
    widths: [
      WIDTH.name, WIDTH.contacts, WIDTH.listing,
      WIDTH.date, WIDTH.date, WIDTH.nights, WIDTH.sum, WIDTH.status, WIDTH.date
    ],
    // Заезд и выезд — ДВА столбца, а не один «Заезд — выезд», как было в CSV.
    // Там это была строка, и отобрать брони по дате заезда было нельзя; здесь
    // это настоящие даты, и фильтр в шапке работает по ним.
    head: [
      t.moderation.reportsColGuest,
      t.moderation.reportsColContacts,
      t.moderation.reportsColListing,
      t.moderation.reportsColCheckIn,
      t.moderation.reportsColCheckOut,
      t.moderation.reportsColNights,
      t.moderation.reportsColSum,
      t.moderation.reportsColStatus,
      t.moderation.reportsColDate
    ],
    rows: data.bookings.map(booking => [
      text(booking.userName || '—'),
      text([booking.userPhone, booking.userEmail].filter(Boolean).join(' · ')),
      text(deps.listingTitle(booking.propertyId)),
      date(booking.checkInDate),
      date(booking.checkOutDate),
      booking.nights === undefined ? blank : number(booking.nights),
      moneyCell(Number(booking.totalPrice) || 0),
      text(deps.bookingStatusLabel(booking.status)),
      date(booking.createdAt)
    ]),
    notes: data.bookings.length === 0 ? [t.moderation.reportsEmpty] : undefined
  }
}

function listingsSheet(data: MonthReport, deps: ReportExportDeps): XlsxSheet {
  const {t} = deps
  return {
    name: t.moderation.reportsNewListings,
    widths: [WIDTH.listing, WIDTH.tier, WIDTH.owner, WIDTH.date],
    head: [
      t.moderation.reportsColListing,
      t.moderation.reportsColTier,
      t.moderation.reportsColOwner,
      t.moderation.reportsColDate
    ],
    rows: data.listings.map(listing => [
      text(deps.getLocalizedText(listing.title) || listing.id),
      text(tierLabel(tierOf(listing), t)),
      text(deps.ownerName(listing)),
      date(listing.createdAt)
    ]),
    notes: data.listings.length === 0 ? [t.moderation.reportsEmpty] : undefined
  }
}

function paymentsSheet(data: MonthReport, deps: ReportExportDeps): XlsxSheet {
  const {t} = deps
  const paid = data.revenue

  if (!paid) {
    return {
      name: t.moderation.reportsPayments,
      widths: [WIDTH.summaryLabel, WIDTH.sum, WIDTH.count],
      head: [t.moderation.reportsColItem, t.moderation.reportsColSum, t.moderation.revenuePurchases],
      rows: [],
      // Отказ чтения и честно пустой месяц выглядят одинаково, а значат разное:
      // в первом случае деньги могли быть, просто мы их не увидели.
      notes: [deps.revenueFailed ? t.moderation.loadFailed : t.moderation.revenueEmpty]
    }
  }

  const rows: XlsxCell[][] = [
    ...PROVIDERS.map(provider => [
      text(providerLabel(provider, t)),
      moneyCell(paid.byProviderAzn?.[provider] ?? 0),
      number(paid.countByProvider?.[provider] ?? 0)
    ]),
    [label(t.moderation.revenueTier), moneyCell(paid.byKindAzn?.tier ?? 0), blank],
    [label(t.moderation.revenueBoost), moneyCell(paid.byKindAzn?.boost ?? 0), blank],
    [label(t.moderation.revenueRefunded), moneyCell(paid.refundedAzn ?? 0), number(paid.refundCount ?? 0)],
    [label(t.moderation.revenueNet), moneyCell((paid.grossAzn ?? 0) - (paid.refundedAzn ?? 0)), blank]
  ]

  // Оговорки едут в файл обязательно: книгу откроет тот, кто вкладку не видел,
  // и без них итог выглядит окончательным, а он брутто.
  const notes = [t.moderation.revenueGrossNote]
  if ((paid.estimatedCount ?? 0) > 0) {
    notes.push(t.moderation.revenueEstimatedNote.replace('{count}', String(paid.estimatedCount)))
  }
  if ((paid.unconvertedCount ?? 0) > 0) {
    notes.push(t.moderation.revenueUnconvertedNote.replace('{count}', String(paid.unconvertedCount)))
  }
  if ((paid.missingAmountCount ?? 0) > 0) {
    notes.push(t.moderation.revenueMissingNote.replace('{count}', String(paid.missingAmountCount)))
  }
  if (paid.usdRate) notes.push(`${t.moderation.revenueRate}: 1 $ = ${paid.usdRate} ₼`)

  // Суммы «как заплатили», по валютам: Excel в одном столбце два знака валюты
  // держать не умеет, поэтому они идут оговоркой, а не строкой таблицы.
  const byCurrency = Object.entries(paid.gross ?? {})
    .filter(([, amount]) => typeof amount === 'number' && amount !== 0)
    .map(([code, amount]) => money(amount as number, code))
  if (byCurrency.length > 1) notes.push(byCurrency.join(' · '))

  return {
    name: t.moderation.reportsPayments,
    widths: [WIDTH.summaryLabel, WIDTH.sum, WIDTH.count],
    head: [t.moderation.reportsColItem, t.moderation.reportsColSum, t.moderation.revenuePurchases],
    rows,
    notes
  }
}

/* -------------------------------------------------------------------------- */

export function reportSheets(data: MonthReport, deps: ReportExportDeps): XlsxSheet[] {
  return [
    summarySheet(data, deps),
    usersSheet(data, deps),
    bookingsSheet(data, deps),
    listingsSheet(data, deps),
    paymentsSheet(data, deps)
  ]
}

export function exportReport(data: MonthReport, deps: ReportExportDeps): void {
  downloadXlsx(`birklik-${data.month}.xlsx`, buildXlsx(reportSheets(data, deps)))
}
