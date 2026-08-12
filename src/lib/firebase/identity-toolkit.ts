import 'server-only'

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
const BASE_URL = 'https://identitytoolkit.googleapis.com/v1'

export class IdentityToolkitError extends Error {
  code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

const ERROR_CODE_MAP: Record<string, string> = {
  EMAIL_NOT_FOUND: 'auth/user-not-found',
  INVALID_PASSWORD: 'auth/wrong-password',
  INVALID_LOGIN_CREDENTIALS: 'auth/invalid-credential',
  USER_DISABLED: 'auth/user-disabled',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'auth/too-many-requests',
  EMAIL_EXISTS: 'auth/email-already-in-use',
  INVALID_EMAIL: 'auth/invalid-email',
  INVALID_OOB_CODE: 'auth/invalid-action-code',
  EXPIRED_OOB_CODE: 'auth/expired-action-code',
  USER_NOT_FOUND: 'auth/user-not-found'
}

function toAuthErrorCode(message: string): string {
  const key = message.split(':')[0].trim()
  if (key === 'WEAK_PASSWORD') return 'auth/weak-password'
  return ERROR_CODE_MAP[key] ?? 'auth/unknown-error'
}

async function callIdentityToolkit<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  if (!API_KEY) throw new IdentityToolkitError('auth/unknown-error')

  let response: Response
  try {
    response = await fetch(`${BASE_URL}/accounts:${endpoint}?key=${API_KEY}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    })
  } catch {
    throw new IdentityToolkitError('auth/network-request-failed')
  }

  const data = await response.json() as {error?: {message?: string}} & T
  if (!response.ok) {
    throw new IdentityToolkitError(toAuthErrorCode(data.error?.message ?? ''))
  }
  return data
}

export interface SignInResult {
  idToken: string
  localId: string
  email: string
  emailVerified: boolean
}

export async function signInWithPassword(email: string, password: string): Promise<SignInResult> {
  const result = await callIdentityToolkit<{idToken: string; localId: string; email: string}>('signInWithPassword', {
    email,
    password,
    returnSecureToken: true
  })
  // signInWithPassword doesn't return emailVerified — look it up from the fresh idToken.
  const [account] = await lookupAccounts(result.idToken)
  return {...result, emailVerified: account?.emailVerified ?? false}
}

export interface SignUpResult {
  idToken: string
  localId: string
}

/**
 * Регистрация пользователя. Заменяет adminAuth.createUser: signUp сразу
 * возвращает idToken, поэтому отдельный вход после регистрации не нужен.
 */
export async function signUpWithPassword(email: string, password: string): Promise<SignUpResult> {
  return callIdentityToolkit<SignUpResult>('signUp', {email, password, returnSecureToken: true})
}

/** Отображаемое имя задаётся отдельным вызовом — signUp его не принимает. */
export async function updateDisplayName(idToken: string, displayName: string): Promise<void> {
  await callIdentityToolkit('update', {idToken, displayName, returnSecureToken: false})
}

interface AccountInfo {
  localId: string
  email: string
  emailVerified: boolean
}

async function lookupAccounts(idToken: string): Promise<AccountInfo[]> {
  const result = await callIdentityToolkit<{users: AccountInfo[]}>('lookup', {idToken})
  return result.users ?? []
}

export type OobRequestType = 'VERIFY_EMAIL' | 'PASSWORD_RESET'

export async function sendOobCode(requestType: OobRequestType, params: {idToken: string} | {email: string}): Promise<void> {
  await callIdentityToolkit('sendOobCode', {requestType, ...params})
}

export async function verifyPasswordResetCode(oobCode: string): Promise<{email: string}> {
  return callIdentityToolkit<{email: string}>('resetPassword', {oobCode})
}

export async function confirmPasswordReset(oobCode: string, newPassword: string): Promise<{email: string}> {
  return callIdentityToolkit<{email: string}>('resetPassword', {oobCode, newPassword})
}

export async function applyEmailVerificationCode(oobCode: string): Promise<void> {
  await callIdentityToolkit('update', {oobCode})
}
