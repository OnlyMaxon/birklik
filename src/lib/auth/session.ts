import 'server-only'
import {cookies} from 'next/headers'
import {importX509, jwtVerify, type JWTPayload} from 'jose'
import {getAccessToken, getServiceAccount} from '@/lib/firebase/google-auth'

const SESSION_COOKIE_NAME = 'session'
const SESSION_EXPIRES_IN_MS = 14 * 24 * 60 * 60 * 1000 // 14 days — Firebase's max for session cookies

const IDENTITY_TOOLKIT_HOST = 'https://identitytoolkit.googleapis.com/v1'
// Сертификаты, которыми Google подписывает именно session-куки (у ID-токенов
// они другие). Отдаются как x509 PEM, ключ объекта — kid из заголовка токена.
const SESSION_COOKIE_CERTS_URL = 'https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys'

export async function createSession(idToken: string): Promise<void> {
  const {projectId} = getServiceAccount()
  const accessToken = await getAccessToken()

  const response = await fetch(`${IDENTITY_TOOLKIT_HOST}/projects/${projectId}:createSessionCookie`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({idToken, validDuration: String(SESSION_EXPIRES_IN_MS / 1000)})
  })

  if (!response.ok) {
    throw new Error(`Failed to create session cookie: ${response.status} ${await response.text()}`)
  }

  const {sessionCookie} = (await response.json()) as {sessionCookie: string}
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_EXPIRES_IN_MS / 1000
  })
}

export interface Session {
  uid: string
  email: string | null
  emailVerified: boolean
  moderator: boolean
}

interface CachedCertificates {
  certificates: Record<string, string>
  expiresAtMs: number
}

let cachedCertificates: CachedCertificates | undefined

async function getSigningCertificates(): Promise<Record<string, string>> {
  if (cachedCertificates && cachedCertificates.expiresAtMs > Date.now()) {
    return cachedCertificates.certificates
  }

  const response = await fetch(SESSION_COOKIE_CERTS_URL)
  if (!response.ok) throw new Error(`Failed to fetch session cookie certificates: ${response.status}`)

  const certificates = (await response.json()) as Record<string, string>
  // Google сам сообщает срок жизни сертификатов — уважаем его, иначе ротация
  // ключей начнёт ронять проверку сессий.
  const maxAge = Number(/max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '')?.[1] ?? 3600)
  cachedCertificates = {certificates, expiresAtMs: Date.now() + maxAge * 1000}

  return certificates
}

/**
 * Отзыв сессии. Firebase хранит момент, начиная с которого токены пользователя
 * считаются валидными: смена пароля или принудительный выход двигают его вперёд.
 * Кука, выписанная раньше, должна перестать действовать — Admin SDK делал ту же
 * проверку при verifySessionCookie(cookie, true), сохраняем поведение.
 */
async function isRevoked(uid: string, authTimeSeconds: number): Promise<boolean> {
  const {projectId} = getServiceAccount()
  const accessToken = await getAccessToken()

  const response = await fetch(`${IDENTITY_TOOLKIT_HOST}/projects/${projectId}/accounts:lookup`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({localId: [uid]})
  })

  // Не смогли проверить — считаем сессию отозванной. Отказ в доступе при сбое
  // безопаснее, чем пропуск потенциально отозванной куки.
  if (!response.ok) return true

  const data = (await response.json()) as {users?: Array<{validSince?: string; disabled?: boolean}>}
  const user = data.users?.[0]
  if (!user || user.disabled) return true

  const validSince = Number(user.validSince ?? 0)
  return Number.isFinite(validSince) && authTimeSeconds < validSince
}

interface SessionCookiePayload extends JWTPayload {
  auth_time?: number
  email?: string
  email_verified?: boolean
  moderator?: boolean
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!sessionCookie) return null

  try {
    const {projectId} = getServiceAccount()
    const certificates = await getSigningCertificates()

    const {payload} = await jwtVerify<SessionCookiePayload>(
      sessionCookie,
      async header => {
        if (header.alg !== 'RS256') throw new Error('Unexpected session cookie algorithm')
        const certificate = header.kid ? certificates[header.kid] : undefined
        if (!certificate) throw new Error('Unknown session cookie key id')
        return importX509(certificate, 'RS256')
      },
      {
        issuer: `https://session.firebase.google.com/${projectId}`,
        audience: projectId,
        // jwtVerify сам проверяет exp и nbf; ограничиваем ещё и расхождение часов.
        clockTolerance: 60
      }
    )

    const uid = payload.sub
    if (!uid) return null

    const authTime = typeof payload.auth_time === 'number' ? payload.auth_time : 0
    if (await isRevoked(uid, authTime)) return null

    return {
      uid,
      email: payload.email ?? null,
      emailVerified: payload.email_verified === true,
      moderator: payload.moderator === true
    }
  } catch {
    // Подпись не сошлась, срок истёк, чужая аудитория — во всех случаях гостя.
    return null
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}
