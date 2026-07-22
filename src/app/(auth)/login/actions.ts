'use server'

import {signInWithPassword, sendOobCode, IdentityToolkitError} from '@/lib/firebase/identity-toolkit'
import {createSession} from '@/lib/auth/session'
import {adminAuth} from '@/lib/firebase/admin'
import {loginSchema, requestPasswordResetSchema} from './validators'

export interface LoginActionResult {
  success: boolean
  error?: string
  customToken?: string
  emailVerified?: boolean
}

export async function loginAction(email: string, password: string): Promise<LoginActionResult> {
  const parsed = loginSchema.safeParse({email, password})
  if (!parsed.success) return {success: false, error: 'auth/invalid-email'}

  try {
    const {idToken, localId, emailVerified} = await signInWithPassword(parsed.data.email, parsed.data.password)
    await createSession(idToken)
    const customToken = await adminAuth.createCustomToken(localId)
    return {success: true, customToken, emailVerified}
  } catch (error) {
    const code = error instanceof IdentityToolkitError ? error.code : 'auth/unknown-error'
    return {success: false, error: code}
  }
}

export interface RequestPasswordResetResult {
  success: boolean
  error?: string
}

export async function requestPasswordResetAction(email: string): Promise<RequestPasswordResetResult> {
  const parsed = requestPasswordResetSchema.safeParse({email})
  if (!parsed.success) return {success: false, error: 'auth/invalid-email'}

  try {
    await sendOobCode('PASSWORD_RESET', {email: parsed.data.email})
    return {success: true}
  } catch (error) {
    const code = error instanceof IdentityToolkitError ? error.code : 'auth/unknown-error'
    return {success: false, error: code}
  }
}
