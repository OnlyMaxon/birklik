'use server'

import {setDoc} from '@/lib/firebase/firestore-rest'
import {createSession, type SessionClaims} from '@/lib/auth/session'
import {profileSchema} from './validators'

export interface CompleteRegistrationResult {
  success: boolean
  error?: string
}

/**
 * Завершает регистрацию после того, как браузер уже создал пользователя.
 *
 * Учётку заводит клиентский SDK — только он проходит App Check. Здесь остаётся
 * серверная часть: выписать сессионную куку и создать профиль в Firestore.
 *
 * uid берётся из выписанной сессии, а не из аргументов: createSession отдаёт
 * idToken на проверку Google и возвращает подтверждённый идентификатор.
 * Подставить чужой uid клиент не может.
 */
export async function completeRegistrationAction(
  idToken: string,
  name: string,
  phone: string
): Promise<CompleteRegistrationResult> {
  const parsed = profileSchema.safeParse({name, phone})
  if (!parsed.success) {
    return {success: false, error: parsed.error.issues[0]?.message || 'auth/unknown-error'}
  }

  let session: SessionClaims
  try {
    session = await createSession(idToken)
  } catch {
    return {success: false, error: 'auth/invalid-user-token'}
  }

  if (!session.uid) return {success: false, error: 'auth/invalid-user-token'}

  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(parsed.data.name)}&background=1a365d&color=fff`

  try {
    await setDoc('users', session.uid, {
      name: parsed.data.name,
      // Почту берём из токена, а не из формы — она уже подтверждена Firebase.
      email: session.email ?? '',
      phone: parsed.data.phone,
      avatar: avatarUrl,
      createdAt: new Date().toISOString()
    })
  } catch {
    return {success: false, error: 'auth/unknown-error'}
  }

  return {success: true}
}
