'use server'

import {adminAuth, adminDb} from '@/lib/firebase/admin'
import {signInWithPassword, sendOobCode, IdentityToolkitError} from '@/lib/firebase/identity-toolkit'
import {createSession} from '@/lib/auth/session'
import {registerSchema} from './validators'

export interface RegisterActionResult {
  success: boolean
  error?: string
  customToken?: string
}

interface AdminAuthError {
  code: string
}

function isAdminAuthError(error: unknown): error is AdminAuthError {
  return typeof error === 'object' && error !== null && 'code' in error && typeof (error as AdminAuthError).code === 'string'
}

// Admin SDK error codes differ from the client SDK codes the UI already knows how to
// render — normalize them onto the same `auth/...` vocabulary.
function toAuthErrorCode(error: unknown): string {
  if (error instanceof IdentityToolkitError) return error.code
  if (isAdminAuthError(error)) {
    if (error.code === 'auth/email-already-exists') return 'auth/email-already-in-use'
    if (error.code === 'auth/invalid-password') return 'auth/weak-password'
    return error.code
  }
  return 'auth/unknown-error'
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
    const userRecord = await adminAuth.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      displayName: parsed.data.name
    })

    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(parsed.data.name)}&background=1a365d&color=fff`
    await adminDb.collection('users').doc(userRecord.uid).set({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      avatar: avatarUrl,
      createdAt: new Date().toISOString()
    })

    // Sign in immediately to get a fresh ID token — needed both for the session
    // cookie and to trigger Firebase's own verification-email template via sendOobCode.
    const {idToken} = await signInWithPassword(parsed.data.email, parsed.data.password)
    await sendOobCode('VERIFY_EMAIL', {idToken})
    await createSession(idToken)

    const customToken = await adminAuth.createCustomToken(userRecord.uid)
    return {success: true, customToken}
  } catch (error) {
    return {success: false, error: toAuthErrorCode(error)}
  }
}
