import type {Language, RevenueProvider, Translations} from '@birklik/core/types'
import type {ReportTier} from './reports-data'

/**
 * Подписи отчёта — общие для экрана и для выгрузки в Excel.
 *
 * Вынесены из `reports-tab.tsx` ровно затем, чтобы выгрузка могла звать их, не
 * таща за собой вкладку: тест на книгу Excel пишется на обычный модуль, а на
 * JSX не пишется.
 *
 * ⚠️ Все подписи берутся из `t`. Писать их тернарником по языку, как местами
 * сделано в соседней модераторке, здесь нельзя: отчёт печатают и выгружают, и
 * строка, забытая в одном из трёх языков, уедет к владельцу в файле.
 */

const MONTH_KEYS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
] as const

/** Знак валюты для сумм «как заплатили». Незнакомую пишем кодом: `10 PLN`. */
export const CURRENCY_SIGNS: Record<string, string> = {AZN: '₼', USD: '$', EUR: '€'}

export const PROVIDERS: RevenueProvider[] = ['azericard', 'app_store', 'google_play']

export const TIERS: ReportTier[] = ['standard', 'vip', 'premium']

/** Сумма для показа: `55 ₼`, `16.83 ₼`. Целые — без дробной части. */
export function money(value: number | undefined, sign = '₼'): string {
  const rounded = Math.round((value ?? 0) * 100) / 100
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)} ${sign}`
}

/** `2026-11` → «Ноябрь 2026». */
export function monthLabel(month: string, t: Translations): string {
  const [year, index] = month.split('-')
  const key = MONTH_KEYS[Number(index) - 1]
  return key ? `${t.calendar.months[key]} ${year}` : month
}

export function providerLabel(provider: RevenueProvider, t: Translations): string {
  if (provider === 'app_store') return t.moderation.providerAppStore
  if (provider === 'google_play') return t.moderation.providerGooglePlay
  return t.moderation.providerAzericard
}

export function tierLabel(tier: ReportTier, t: Translations): string {
  if (tier === 'vip') return t.moderation.reportsTierVip
  if (tier === 'premium') return t.moderation.reportsTierPremium
  return t.moderation.reportsTierStandard
}

/** Язык для дат. Тот же набор, что в модераторке: отчёт и вкладки рядом должны совпадать. */
export function dateLocale(language: Language): string {
  return language === 'en' ? 'en-GB' : language === 'ru' ? 'ru-RU' : 'az-Latn-AZ'
}
