import 'server-only'
import {importX509, jwtVerify, type JWTPayload} from 'jose'
import {getServiceAccount} from '@/lib/firebase/google-auth'

/**
 * Проверка обычного токена входа Firebase — того, что присылает мобильное
 * приложение.
 *
 * Зачем отдельно от `getSession`. Сайт живёт на сессионной куке: браузер меняет
 * на неё токен сразу после входа, и дальше сервер читает куку. У приложения куки
 * нет и быть не может — там нет ни браузера, ни серверного рендера, вход хранит
 * сам SDK. Поэтому оно шлёт токен в заголовке `Authorization`.
 *
 * ⚠️ Проверка похожа на кукину, но НЕ та же, и подменять одну другой нельзя:
 * у токенов входа другой издатель и **другие сертификаты подписи**. Кука
 * подписана ключами Identity Toolkit, токен входа — ключами securetoken.
 * Перепутаешь — подпись просто не сойдётся, и вход из приложения перестанет
 * работать целиком.
 *
 * Отзыв здесь не проверяется намеренно. Токен входа живёт час и обновляется
 * самим SDK; за этот час обход к Identity Toolkit на каждый запрос стоил бы
 * дороже, чем окно в шестьдесят минут после смены пароля. У куки срок
 * четырнадцать дней — там проверка отзыва обязательна, и она есть.
 */

// Сертификаты, которыми Google подписывает ID-токены. У session-кук другой
// адрес — см. SESSION_COOKIE_CERTS_URL в session.ts.
const ID_TOKEN_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'

export interface IdTokenClaims {
  uid: string
  email: string | null
  emailVerified: boolean
  moderator: boolean
}

interface IdTokenPayload extends JWTPayload {
  email?: string
  email_verified?: boolean
  moderator?: boolean
}

interface CachedCertificates {
  certificates: Record<string, string>
  expiresAtMs: number
}

let cached: CachedCertificates | undefined

async function getCertificates(): Promise<Record<string, string>> {
  if (cached && cached.expiresAtMs > Date.now()) return cached.certificates

  const response = await fetch(ID_TOKEN_CERTS_URL)
  if (!response.ok) throw new Error(`Failed to fetch ID token certificates: ${response.status}`)

  const certificates = (await response.json()) as Record<string, string>
  // Срок жизни сообщает сам Google — уважаем его, иначе ротация ключей начнёт
  // ронять проверку.
  const maxAge = Number(
    /max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '')?.[1] ?? 3600
  )
  cached = {certificates, expiresAtMs: Date.now() + maxAge * 1000}

  return certificates
}

/**
 * Кто пришёл, по заголовку `Authorization: Bearer <idToken>`.
 *
 * @returns null для любого негодного токена — просроченного, чужого,
 *   подделанного или отсутствующего. Разбирать причину вызывающему коду незачем:
 *   во всех случаях это гость.
 */
export async function verifyIdToken(request: Request): Promise<IdTokenClaims | null> {
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return null

  try {
    const {projectId} = getServiceAccount()
    const certificates = await getCertificates()

    const {payload} = await jwtVerify<IdTokenPayload>(
      token,
      async jwtHeader => {
        if (jwtHeader.alg !== 'RS256') throw new Error('Unexpected ID token algorithm')
        const certificate = jwtHeader.kid ? certificates[jwtHeader.kid] : undefined
        if (!certificate) throw new Error('Unknown ID token key id')
        return importX509(certificate, 'RS256')
      },
      {
        issuer: `https://securetoken.google.com/${projectId}`,
        audience: projectId,
        clockTolerance: 60
      }
    )

    const uid = payload.sub
    if (!uid) return null

    return {
      uid,
      email: payload.email ?? null,
      emailVerified: payload.email_verified === true,
      moderator: payload.moderator === true
    }
  } catch {
    return null
  }
}
