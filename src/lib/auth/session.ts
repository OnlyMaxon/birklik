import 'server-only'
import {cookies} from 'next/headers'
import {adminAuth} from '@/lib/firebase/admin'
import {SESSION_COOKIE_NAME} from './session-cookie'

const SESSION_EXPIRES_IN_MS = 14 * 24 * 60 * 60 * 1000 // 14 days — Firebase's max for session cookies

export async function createSession(idToken: string): Promise<void> {
  const sessionCookie = await adminAuth.createSessionCookie(idToken, {expiresIn: SESSION_EXPIRES_IN_MS})
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

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!sessionCookie) return null

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      emailVerified: decoded.email_verified === true,
      moderator: decoded.moderator === true
    }
  } catch {
    return null
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}
