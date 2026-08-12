'use server'

import {setDoc} from '@/lib/firebase/firestore-rest'
import {createCustomToken} from '@/lib/firebase/google-auth'
import {
  signUpWithPassword,
  updateDisplayName,
  sendOobCode,
  IdentityToolkitError
} from '@/lib/firebase/identity-toolkit'
import {createSession} from '@/lib/auth/session'
import {registerSchema} from './validators'

export interface RegisterActionResult {
  success: boolean
  error?: string
  customToken?: string
}

export async function registerAction(
  name: string,
  email: string,
  phone: string,
  password: string
): Promise<RegisterActionResult> {
  const parsed = registerSchema.safeParse({name, email, phone, password})
  if (!parsed.success) {
    return {success: false, error: parsed.error.issues[0]?.message || 'auth/unknown-error'}
  }

  try {
    // signUp сразу отдаёт idToken — он нужен и для письма с подтверждением,
    // и для сессионной куки.
    const {idToken, localId} = await signUpWithPassword(parsed.data.email, parsed.data.password)
    await updateDisplayName(idToken, parsed.data.name)

    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(parsed.data.name)}&background=1a365d&color=fff`
    await setDoc('users', localId, {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      avatar: avatarUrl,
      createdAt: new Date().toISOString()
    })

    await sendOobCode('VERIFY_EMAIL', {idToken})
    await createSession(idToken)

    const customToken = await createCustomToken(localId)
    return {success: true, customToken}
  } catch (error) {
    const code = error instanceof IdentityToolkitError ? error.code : 'auth/unknown-error'
    return {success: false, error: code}
  }
}
