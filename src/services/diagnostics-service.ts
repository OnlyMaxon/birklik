import {getFunctions, httpsCallable} from 'firebase/functions'
import firebaseApp from '@/lib/firebase/client'

/**
 * Донесение о том, чем кончилась подача объявления на сайте.
 *
 * Пара к `diagnostics-service.ts` приложения: функция на сервере одна
 * (`reportClientError`), входов в неё два — как у жалоб на комментарии. Поле
 * `source` отличает сайт от приложения, и разойтись они не могут, потому что
 * решает, что записать, сервер.
 *
 * ## Почему это нужно и сайту тоже
 *
 * Разбор 21 ноября был про приложение, но слепота оказалась общей:
 * `createProperty` в `property-service.ts` ловит любую ошибку, пишет её в
 * консоль БРАУЗЕРА и возвращает `null`. Консоль браузера человека нам
 * недоступна ровно так же, как память его телефона, — то есть на сайте мы знаем
 * не больше, чем знали про Талеха.
 *
 * ⚠️ Отправка никогда не бросает и никогда не задерживает человека: окно с
 * сообщением об отказе он должен увидеть сразу, а не после нашего запроса.
 */

/** Буквы кода: без `I`, `O`, `0`, `1` — код читают вслух по телефону. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export interface SiteReport {
  outcome: 'success' | 'error'
  code: string
  step?: 'photos' | 'saving'
  photosTotal?: number
  photosDone?: number
  durationMs?: number
  tier?: string
  propertyId?: string
  errorName?: string
  errorCode?: string
  errorMessage?: string
}

/** `ELAN-7F3K`. Придумывается на устройстве — см. шапку службы в приложении. */
export function newReportCode(prefix = 'ELAN'): string {
  let tail = ''
  for (let i = 0; i < 4; i += 1) {
    tail += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return `${prefix}-${tail}`
}

const codeOf = (error: unknown): string =>
  typeof error === 'object' && error !== null && typeof (error as {code?: unknown}).code === 'string'
    ? (error as {code: string}).code
    : ''

/** Подробности отказа для разбора. Человеку они не показываются. */
export function describeFailure(error: unknown): Pick<
  SiteReport,
  'errorName' | 'errorCode' | 'errorMessage'
> {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return {
    errorName: error instanceof Error ? error.name : typeof error,
    errorCode: codeOf(error) || undefined,
    errorMessage: message || undefined
  }
}

export async function reportSubmit(report: SiteReport): Promise<void> {
  // Браузерная половина Firebase на сервере не живёт, а подача идёт только из
  // браузера: на сервере здесь делать нечего.
  if (typeof window === 'undefined') return

  try {
    const functions = getFunctions(firebaseApp, 'europe-west1')
    const report_ = httpsCallable<Record<string, unknown>, {accepted: boolean}>(
      functions,
      'reportClientError'
    )
    await report_({
      ...report,
      flow: 'add-listing',
      source: 'site',
      platform: 'web',
      // Строка обозревателя обрезается сервером до шестидесяти знаков. Нужна
      // она ровно для одного: отличить «у всех в Safari» от «у одного человека».
      device: typeof navigator === 'undefined' ? null : navigator.userAgent,
      online: typeof navigator === 'undefined' ? null : navigator.onLine
    })
  } catch {
    // Молча. Донесение — наша диагностика, а не работа человека: вторая ошибка
    // поверх первой только подменила бы ему настоящую причину.
  }
}
