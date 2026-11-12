'use client'

import React from 'react'
import type {MonthlyRevenue, RevenueProvider, Translations} from '@birklik/core/types'

/**
 * Вкладка «Выручка» в модераторке.
 *
 * Показывает один месяц целиком: сколько заработали, через какую кассу и за
 * что. Считает не она — считает триггер `recordRevenue` в функциях по журналу
 * платежей; здесь только показ готовых чисел из `revenue/{YYYY-MM}`.
 *
 * ⚠️ Числа БРУТТО: столько заплатили покупатели. Apple и Google удерживают
 * свою долю, и на счёт придёт меньше. Оговорка под итогом не украшение — без
 * неё владелец сверит итог с поступлением на счёт и решит, что счётчик врёт.
 */

const MONTH_KEYS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
] as const

/** Знак валюты для сумм «как заплатили». Незнакомую пишем кодом: `10 PLN`. */
const CURRENCY_SIGNS: Record<string, string> = {AZN: '₼', USD: '$', EUR: '€'}

/**
 * Сумма для показа: `55 ₼`, `16.83 ₼`.
 *
 * Дробная часть отбрасывается, когда её нет: манатные покупки все целые, и
 * `55.00 ₼` рядом с ценой «55 ₼» на странице тарифов выглядело бы другой
 * суммой. Дробь появляется только у переведённых из валюты.
 */
function money(value: number | undefined, sign = '₼'): string {
  const amount = value ?? 0
  const rounded = Math.round(amount * 100) / 100
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)} ${sign}`
}

/** `2026-11` → «Ноябрь 2026». */
function monthLabel(month: string, t: Translations): string {
  const [year, index] = month.split('-')
  const key = MONTH_KEYS[Number(index) - 1]
  return key ? `${t.calendar.months[key]} ${year}` : month
}

const PROVIDERS: RevenueProvider[] = ['azericard', 'app_store', 'google_play']

function providerLabel(provider: RevenueProvider, t: Translations): string {
  if (provider === 'app_store') return t.moderation.providerAppStore
  if (provider === 'google_play') return t.moderation.providerGooglePlay
  return t.moderation.providerAzericard
}

interface RevenueTabProps {
  months: MonthlyRevenue[]
  failed: boolean
  t: Translations
}

export const RevenueTab: React.FC<RevenueTabProps> = ({months, failed, t}) => {
  // Выбранный месяц держим ИМЕНЕМ, а не номером в списке: список
  // перезагружается, и первого числа в нём появляется новый месяц — номер
  // поехал бы, а имя нет.
  const [selected, setSelected] = React.useState<string>('')
  const current = months.find(item => item.month === selected) ?? months[0]

  if (failed) {
    return <div className="moderation-empty card">{t.moderation.loadFailed}</div>
  }

  if (!current) {
    return <div className="moderation-empty card">{t.moderation.revenueEmpty}</div>
  }

  const refunded = current.refundedAzn ?? 0
  const gross = current.grossAzn ?? 0

  /** Суммы «как заплатили», по валютам: `75 ₼ · 10 $`. */
  const byCurrency = Object.entries(current.gross ?? {})
    .filter(([, amount]) => typeof amount === 'number' && amount !== 0)
    .map(([code, amount]) => money(amount as number, CURRENCY_SIGNS[code] ?? code))

  return (
    <div className="revenue-tab">
      {months.length > 1 && (
        <div className="revenue-months">
          {months.map(item => (
            <button
              key={item.month}
              type="button"
              className={`revenue-month-btn ${item.month === current.month ? 'active' : ''}`}
              onClick={() => setSelected(item.month)}
            >
              {monthLabel(item.month, t)}
            </button>
          ))}
        </div>
      )}

      <div className="revenue-total card">
        <div className="revenue-total-label">{t.moderation.revenueTotal}</div>
        <div className="revenue-total-value">{money(gross)}</div>
        <div className="revenue-total-meta">
          {current.count ?? 0} {t.moderation.revenuePurchases}
          {byCurrency.length > 1 && <span className="revenue-dim"> · {byCurrency.join(' · ')}</span>}
        </div>

        {refunded > 0 && (
          <div className="revenue-refund">
            <span>
              {t.moderation.revenueRefunded}: {money(refunded)} ({current.refundCount ?? 0})
            </span>
            <strong>
              {t.moderation.revenueNet}: {money(gross - refunded)}
            </strong>
          </div>
        )}
      </div>

      <div className="revenue-grid">
        <div className="revenue-block card">
          <h3>{t.moderation.revenueByStore}</h3>
          {PROVIDERS.map(provider => (
            <div key={provider} className="revenue-row">
              <span>{providerLabel(provider, t)}</span>
              <span>
                {money(current.byProviderAzn?.[provider])}
                <span className="revenue-dim"> · {current.countByProvider?.[provider] ?? 0}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="revenue-block card">
          <h3>{t.moderation.revenueByProduct}</h3>
          <div className="revenue-row">
            <span>{t.moderation.revenueTier}</span>
            <span>{money(current.byKindAzn?.tier)}</span>
          </div>
          <div className="revenue-row">
            <span>{t.moderation.revenueBoost}</span>
            <span>{money(current.byKindAzn?.boost)}</span>
          </div>
        </div>
      </div>

      {/* Оговорки. Первая — всегда: она объясняет, почему итог не сойдётся с
          поступлением на счёт. Остальные — только когда есть что оговаривать. */}
      <div className="revenue-notes">
        <p>{t.moderation.revenueGrossNote}</p>
        {(current.estimatedCount ?? 0) > 0 && (
          <p>
            {t.moderation.revenueEstimatedNote.replace('{count}', String(current.estimatedCount))}
          </p>
        )}
        {(current.unconvertedCount ?? 0) > 0 && (
          <p>
            {t.moderation.revenueUnconvertedNote.replace(
              '{count}',
              String(current.unconvertedCount)
            )}
          </p>
        )}
        {(current.missingAmountCount ?? 0) > 0 && (
          <p>
            {t.moderation.revenueMissingNote.replace('{count}', String(current.missingAmountCount))}
          </p>
        )}
        {current.usdRate ? (
          <p>
            {t.moderation.revenueRate}: 1 $ = {current.usdRate} ₼
          </p>
        ) : null}
      </div>
    </div>
  )
}
