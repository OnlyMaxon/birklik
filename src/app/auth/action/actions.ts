'use server'

import {
  verifyPasswordResetCode as verifyPasswordResetCodeRest,
  confirmPasswordReset as confirmPasswordResetRest,
  applyEmailVerificationCode,
  IdentityToolkitError
} from '@/lib/firebase/identity-toolkit'

function toResult<T extends Record<string, unknown>>(data: T) {
  return {success: true as const, ...data}
}

function toErrorResult(error: unknown) {
  const code = error instanceof IdentityToolkitError ? error.code : 'auth/unknown-error'
  return {success: false as const, error: code}
}

export async function verifyPasswordResetCodeAction(oobCode: string) {
  try {
    return toResult(await verifyPasswordResetCodeRest(oobCode))
  } catch (error) {
    return toErrorResult(error)
  }
}

export async function confirmPasswordResetAction(oobCode: string, newPassword: string) {
  try {
    return toResult(await confirmPasswordResetRest(oobCode, newPassword))
  } catch (error) {
    return toErrorResult(error)
  }
}

export async function verifyEmailAction(oobCode: string) {
  try {
    await applyEmailVerificationCode(oobCode)
    return {success: true as const}
  } catch (error) {
    return toErrorResult(error)
  }
}
