'use client'

import React from 'react'
import type {Booking, Language, MonthlyRevenue, Property, RevenueProvider, Translations} from '@birklik/core/types'
import type {UserRecord} from '@/services/user-service'
import {buildMonthReport, reportMonths, tierOf, undatedCounts, type MonthReport, type ReportSources, type ReportTier} from './reports-data'
import {buildCsv, csvNumber, downloadCsv, type CsvSection} from './reports-export'

/**
 * Вкладка «Отчёты» в модераторке.
 *
 * Один месяц целиком, четырьмя разделами: кто зарегистрировался, кто бронировал,
 * какие объявления появились и с каким тарифом, сколько оплат пришло. Оплаты
 * раньше жили отдельной вкладкой «Выручка» — владелец решил 2026-11-17 собрать
 * всё в одном месте, и отдельной вкладки на сайте больше нет.
 *
 * ⚠️ Месяц считается по БАКИНСКОМУ времени (`bakuMonth` из общего пакета) — тем
 * же, которым считает счётчик оплат на сервере. Возьми здесь месяц по UTC, и в
 * отчёте за ноябрь сумма оплат разошлась бы со списками на сутки.
 *
 * ⚠️ Числа оплат — БРУТТО. Apple и Google удерживают свою долю; оговорка под
 * итогом обязательна, иначе владелец сверит её с поступлением на счёт и решит,
 * что отчёт врёт.
 *
 * Новых запросов к Firestore вкладка не делает — считает по тем же данным,
 * которые модераторка уже загрузила для соседних вкладок.
 */

const MONTH_KEYS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
] as const

/** Знак валюты для сумм «как заплатили». Незнакомую пишем кодом: `10 PLN`. */
const CURRENCY_SIGNS: Record<string, string> = {AZN: '₼', USD: '$', EUR: '€'}

const PROVIDERS: RevenueProvider[] = ['azericard', 'app_store', 'google_play']

const TIERS: ReportTier[] = ['standard', 'vip', 'premium']

/** Сумма для показа: `55 ₼`, `16.83 ₼`. Целые — без дробной части. */
function money(value: number | undefined, sign = '₼'): string {
  const rounded = Math.round((value ?? 0) * 100) / 100
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)} ${sign}`
}

/** `2026-11` → «Ноябрь 2026». */
function monthLabel(month: string, t: Translations): string {
  const [year, index] = month.split('-')
  const key = MONTH_KEYS[Number(index) - 1]
  return key ? `${t.calendar.months[key]} ${year}` : month
}

function providerLabel(provider: RevenueProvider, t: Translations): string {
  if (provider === 'app_store') return t.moderation.providerAppStore
  if (provider === 'google_play') return t.moderation.providerGooglePlay
  return t.moderation.providerAzericard
}

function tierLabel(tier: ReportTier, t: Translations): string {
  if (tier === 'vip') return t.moderation.reportsTierVip
  if (tier === 'premium') return t.moderation.reportsTierPremium
  return t.moderation.reportsTierStandard
}

/** Язык для дат. Тот же набор, что в модераторке: отчёт и вкладки рядом должны совпадать. */
function dateLocale(language: Language): string {
  return language === 'en' ? 'en-GB' : language === 'ru' ? 'ru-RU' : 'az-Latn-AZ'
}

interface ReportsTabProps {
  users: UserRecord[]
  bookings: Booking[]
  listings: Property[]
  revenue: MonthlyRevenue[]
  /** Оплаты не прочитались. Пустой месяц и отказ выглядят одинаково, а значат разное. */
  revenueFailed: boolean
  language: Language
  t: Translations
  /** Подписи берём у модераторки, а не пишем свои: статусы должны называться одинаково. */
  bookingStatusLabel: (status: string) => string
  getLocalizedText: (text: Partial<Record<Language, string>>) => string
  formatDate: (iso?: string) => string
}

export const ReportsTab: React.FC<ReportsTabProps> = ({
  users,
  bookings,
  listings,
  revenue,
  revenueFailed,
  language,
  t,
  bookingStatusLabel,
  getLocalizedText,
  formatDate
}) => {
  const sources: ReportSources = React.useMemo(
    () => ({users, bookings, listings, revenue}),
    [users, bookings, listings, revenue]
  )

  const months = React.useMemo(() => reportMonths(sources), [sources])
  // Выбранный месяц держим ИМЕНЕМ, а не номером в списке: первого числа в
  // списке появляется новый месяц, и номер поехал бы, а имя нет.
  const [selected, setSelected] = React.useState('')
  const month = months.includes(selected) ? selected : months[0]
  const report = React.useMemo(
    () => (month ? buildMonthReport(month, sources) : null),
    [month, sources]
  )
  const undated = React.useMemo(() => undatedCounts(sources), [sources])

  /** Объявление могло быть удалено: и отказ, и удаление уносят документ. */
  const listingById = React.useMemo(
    () => new Map(listings.map(listing => [listing.id, listing])),
    [listings]
  )
  const listingTitle = React.useCallback(
    (propertyId: string): string => {
      const listing = listingById.get(propertyId)
      return listing ? getLocalizedText(listing.title) || listing.id : '—'
    },
    [listingById, getLocalizedText]
  )

  /** Имя автора. В объявлении оно есть почти всегда, профиль — на случай старых записей. */
  const userById = React.useMemo(() => new Map(users.map(person => [person.id, person])), [users])
  const ownerName = React.useCallback(
    (listing: Property) =>
      listing.owner?.name || (listing.ownerId ? userById.get(listing.ownerId)?.name : '') || '—',
    [userById]
  )

  const csvSections = React.useCallback(
    (data: MonthReport): CsvSection[] => {
      const sections: CsvSection[] = [
        {
          title: `Birklik.az — ${t.moderation.reportsTab}: ${monthLabel(data.month, t)}`,
          head: [],
          rows: [
            [t.moderation.reportsNewUsers, data.users.length],
            [t.moderation.reportsBookings, data.bookings.length],
            [t.moderation.reportsNewListings, data.listings.length],
            ...TIERS.map(tier => [`   ${tierLabel(tier, t)}`, data.byTier[tier]] as (string | number)[]),
            [t.moderation.reportsPayments, csvNumber(data.revenue?.grossAzn ?? 0)],
            [t.moderation.reportsGeneratedAt, new Date().toLocaleString(dateLocale(language))]
          ]
        },
        {
          title: t.moderation.reportsNewUsers,
          head: [t.moderation.reportsColName, t.moderation.reportsColContacts, t.moderation.reportsColDate],
          rows: data.users.map(person => [
            person.blocked ? `${person.name || '—'} (${t.moderation.reportsBlocked})` : person.name || '—',
            [person.email, person.phone].filter(Boolean).join(' · '),
            formatDate(person.createdAt)
          ])
        },
        {
          title: t.moderation.reportsBookings,
          head: [
            t.moderation.reportsColGuest,
            t.moderation.reportsColContacts,
            t.moderation.reportsColListing,
            t.moderation.reportsColStay,
            t.moderation.reportsColNights,
            t.moderation.reportsColSum,
            t.moderation.reportsColStatus,
            t.moderation.reportsColDate
          ],
          rows: data.bookings.map(booking => [
            booking.userName || '—',
            [booking.userPhone, booking.userEmail].filter(Boolean).join(' · '),
            listingTitle(booking.propertyId),
            `${formatDate(booking.checkInDate)} — ${formatDate(booking.checkOutDate)}`,
            booking.nights ?? '',
            csvNumber(Number(booking.totalPrice) || 0),
            bookingStatusLabel(booking.status),
            formatDate(booking.createdAt)
          ])
        },
        {
          title: t.moderation.reportsNewListings,
          head: [
            t.moderation.reportsColListing,
            t.moderation.reportsColTier,
            t.moderation.reportsColOwner,
            t.moderation.reportsColDate
          ],
          rows: data.listings.map(listing => [
            getLocalizedText(listing.title) || listing.id,
            tierLabel(tierOf(listing), t),
            ownerName(listing),
            formatDate(listing.createdAt)
          ])
        }
      ]

      if (data.revenue) {
        const paid = data.revenue
        sections.push({
          title: t.moderation.reportsPayments,
          head: [t.moderation.reportsColName, t.moderation.reportsColSum, t.moderation.revenuePurchases],
          rows: [
            ...PROVIDERS.map(provider => [
              providerLabel(provider, t),
              csvNumber(paid.byProviderAzn?.[provider] ?? 0),
              paid.countByProvider?.[provider] ?? 0
            ] as (string | number)[]),
            [t.moderation.revenueTier, csvNumber(paid.byKindAzn?.tier ?? 0), ''],
            [t.moderation.revenueBoost, csvNumber(paid.byKindAzn?.boost ?? 0), ''],
            [t.moderation.revenueRefunded, csvNumber(paid.refundedAzn ?? 0), paid.refundCount ?? 0],
            [t.moderation.revenueNet, csvNumber((paid.grossAzn ?? 0) - (paid.refundedAzn ?? 0)), ''],
            // Оговорка про брутто едет и в файл: распечатку увидят те, кто
            // вкладку не открывал, и без неё итог выглядит окончательным.
            [t.moderation.revenueGrossNote, '', '']
          ]
        })
      }

      return sections
    },
    [t, language, formatDate, getLocalizedText, bookingStatusLabel, listingTitle, ownerName]
  )

  const exportCsv = React.useCallback(() => {
    if (!report) return
    downloadCsv(`birklik-${report.month}.csv`, buildCsv(csvSections(report)))
  }, [report, csvSections])

  if (!report) {
    return (
      <div className="moderation-empty card">
        <p>{t.moderation.reportsNoData}</p>
      </div>
    )
  }

  const paid = report.revenue
  const gross = paid?.grossAzn ?? 0
  const refunded = paid?.refundedAzn ?? 0
  /** Суммы «как заплатили», по валютам: `75 ₼ · 10 $`. */
  const byCurrency = Object.entries(paid?.gross ?? {})
    .filter(([, amount]) => typeof amount === 'number' && amount !== 0)
    .map(([code, amount]) => money(amount as number, CURRENCY_SIGNS[code] ?? code))

  return (
    <div className="reports-tab">
      <div className="reports-toolbar reports-noprint">
        {months.length > 1 && (
          <div className="revenue-months">
            {months.map(item => (
              <button
                key={item}
                type="button"
                className={`revenue-month-btn ${item === report.month ? 'active' : ''}`}
                onClick={() => setSelected(item)}
              >
                {monthLabel(item, t)}
              </button>
            ))}
          </div>
        )}
        <div className="reports-actions">
          {/* Печать и есть PDF: в окне печати любого браузера выбирается
              «Сохранить как PDF». Своей сборки PDF нет нарочно — библиотека
              для неё весила бы больше всей вкладки. */}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => window.print()}>
            {t.moderation.reportsPrint}
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={exportCsv}>
            {t.moderation.reportsExcel}
          </button>
        </div>
      </div>

      <div className="reports-print">
        <div className="reports-head">
          <h2>Birklik.az — {t.moderation.reportsTab}</h2>
          <p>
            {monthLabel(report.month, t)} · {t.moderation.reportsGeneratedAt}:{' '}
            {new Date().toLocaleString(dateLocale(language))}
          </p>
        </div>

        <div className="reports-tiles">
          <div className="reports-tile card">
            <span className="reports-tile-label">{t.moderation.reportsNewUsers}</span>
            <strong className="reports-tile-value">{report.users.length}</strong>
          </div>
          <div className="reports-tile card">
            <span className="reports-tile-label">{t.moderation.reportsBookings}</span>
            <strong className="reports-tile-value">{report.bookings.length}</strong>
            <span className="reports-tile-meta">{money(report.bookingsSum)}</span>
          </div>
          <div className="reports-tile card">
            <span className="reports-tile-label">{t.moderation.reportsNewListings}</span>
            <strong className="reports-tile-value">{report.listings.length}</strong>
            <span className="reports-tile-meta">
              {TIERS.map(tier => `${tierLabel(tier, t)} ${report.byTier[tier]}`).join(' · ')}
            </span>
          </div>
          <div className="reports-tile card">
            <span className="reports-tile-label">{t.moderation.reportsPayments}</span>
            <strong className="reports-tile-value">{money(gross)}</strong>
            <span className="reports-tile-meta">
              {paid?.count ?? 0} {t.moderation.revenuePurchases}
            </span>
          </div>
        </div>

        <section className="reports-section">
          <h3>{t.moderation.reportsPayments}</h3>
          {revenueFailed ? (
            <p className="reports-note">{t.moderation.loadFailed}</p>
          ) : !paid ? (
            <p className="reports-note">{t.moderation.revenueEmpty}</p>
          ) : (
            <>
              <div className="revenue-grid">
                <div className="revenue-block card">
                  <h4>{t.moderation.revenueByStore}</h4>
                  {PROVIDERS.map(provider => (
                    <div key={provider} className="revenue-row">
                      <span>{providerLabel(provider, t)}</span>
                      <span>
                        {money(paid.byProviderAzn?.[provider])}
                        <span className="revenue-dim"> · {paid.countByProvider?.[provider] ?? 0}</span>
                      </span>
                    </div>
                  ))}
                  {byCurrency.length > 1 && (
                    <div className="revenue-row">
                      <span className="revenue-dim">{byCurrency.join(' · ')}</span>
                      <span />
                    </div>
                  )}
                </div>
                <div className="revenue-block card">
                  <h4>{t.moderation.revenueByProduct}</h4>
                  <div className="revenue-row">
                    <span>{t.moderation.revenueTier}</span>
                    <span>{money(paid.byKindAzn?.tier)}</span>
                  </div>
                  <div className="revenue-row">
                    <span>{t.moderation.revenueBoost}</span>
                    <span>{money(paid.byKindAzn?.boost)}</span>
                  </div>
                  {refunded > 0 && (
                    <div className="revenue-refund">
                      <span>
                        {t.moderation.revenueRefunded}: {money(refunded)} ({paid.refundCount ?? 0})
                      </span>
                      <strong>
                        {t.moderation.revenueNet}: {money(gross - refunded)}
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Оговорки. Первая — всегда: она объясняет, почему итог не сойдётся
                  с поступлением на счёт. Остальные — когда есть что оговаривать. */}
              <div className="revenue-notes">
                <p>{t.moderation.revenueGrossNote}</p>
                {(paid.estimatedCount ?? 0) > 0 && (
                  <p>{t.moderation.revenueEstimatedNote.replace('{count}', String(paid.estimatedCount))}</p>
                )}
                {(paid.unconvertedCount ?? 0) > 0 && (
                  <p>{t.moderation.revenueUnconvertedNote.replace('{count}', String(paid.unconvertedCount))}</p>
                )}
                {(paid.missingAmountCount ?? 0) > 0 && (
                  <p>{t.moderation.revenueMissingNote.replace('{count}', String(paid.missingAmountCount))}</p>
                )}
                {paid.usdRate ? (
                  <p>
                    {t.moderation.revenueRate}: 1 $ = {paid.usdRate} ₼
                  </p>
                ) : null}
              </div>
            </>
          )}
        </section>

        <section className="reports-section">
          <h3>
            {t.moderation.reportsNewUsers} · {report.users.length}
          </h3>
          {report.users.length === 0 ? (
            <p className="reports-note">{t.moderation.reportsEmpty}</p>
          ) : (
            <div className="reports-table-wrap">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>{t.moderation.reportsColName}</th>
                    <th>{t.moderation.reportsColContacts}</th>
                    <th>{t.moderation.reportsColDate}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.users.map(person => (
                    <tr key={person.id}>
                      <td>
                        {person.name || '—'}
                        {person.blocked && <span className="reports-flag">{t.moderation.reportsBlocked}</span>}
                      </td>
                      <td className="reports-cell-dim">
                        {[person.email, person.phone].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td>{formatDate(person.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="reports-section">
          <h3>
            {t.moderation.reportsBookings} · {report.bookings.length}
          </h3>
          {report.bookings.length === 0 ? (
            <p className="reports-note">{t.moderation.reportsEmpty}</p>
          ) : (
            <div className="reports-table-wrap">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>{t.moderation.reportsColGuest}</th>
                    <th>{t.moderation.reportsColListing}</th>
                    <th>{t.moderation.reportsColStay}</th>
                    <th>{t.moderation.reportsColNights}</th>
                    <th>{t.moderation.reportsColSum}</th>
                    <th>{t.moderation.reportsColStatus}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.bookings.map(booking => (
                    <tr key={booking.id}>
                      <td>
                        {booking.userName || '—'}
                        <span className="reports-cell-dim"> {booking.userPhone || ''}</span>
                      </td>
                      <td>{listingTitle(booking.propertyId)}</td>
                      <td>
                        {formatDate(booking.checkInDate)} — {formatDate(booking.checkOutDate)}
                      </td>
                      <td>{booking.nights ?? '—'}</td>
                      <td>{money(Number(booking.totalPrice) || 0)}</td>
                      <td>{bookingStatusLabel(booking.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="reports-section">
          <h3>
            {t.moderation.reportsNewListings} · {report.listings.length}
          </h3>
          {report.listings.length === 0 ? (
            <p className="reports-note">{t.moderation.reportsEmpty}</p>
          ) : (
            <div className="reports-table-wrap">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>{t.moderation.reportsColListing}</th>
                    <th>{t.moderation.reportsColTier}</th>
                    <th>{t.moderation.reportsColOwner}</th>
                    <th>{t.moderation.reportsColDate}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.listings.map(listing => (
                    <tr key={listing.id}>
                      <td>{getLocalizedText(listing.title) || listing.id}</td>
                      <td>{tierLabel(tierOf(listing), t)}</td>
                      <td>{ownerName(listing)}</td>
                      <td>{formatDate(listing.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Записи без даты ни в один месяц не попадают. Молчать об этом нельзя:
            сумма месяцев тогда не сойдётся с числом на соседних вкладках, и
            понять, куда делись люди, будет нельзя. */}
        {(undated.users > 0 || undated.bookings > 0 || undated.listings > 0) && (
          <p className="reports-note">
            {t.moderation.reportsNoDateNote.replace(
              '{count}',
              String(undated.users + undated.bookings + undated.listings)
            )}
          </p>
        )}
      </div>
    </div>
  )
}
