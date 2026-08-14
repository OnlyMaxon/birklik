import 'server-only'

// Подпись от имени сервис-аккаунта без firebase-admin.
//
// Admin SDK здесь неприменим: он тянет protobufjs, который компилирует парсеры
// через new Function, а Cloudflare Workers запрещают генерацию кода из строк.
// Всё, что нужно от сервис-аккаунта, — подписать RS256-токен, а это умеет
// WebCrypto, доступный в воркере нативно.

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const JWT_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:jwt-bearer'

const ACCESS_TOKEN_LIFETIME_SECONDS = 3600
// Обновляем заранее, чтобы токен не истёк на середине запроса.
const ACCESS_TOKEN_REFRESH_MARGIN_SECONDS = 300

export interface ServiceAccount {
  projectId: string
  clientEmail: string
  privateKey: string
}

export function getServiceAccount(): ServiceAccount {
  // trim обязателен: значения приходят из секретов и .env-файлов, где легко
  // остаётся перевод строки в конце. Лишний символ в client_email превращает
  // JWT-assertion в «account not found» на стороне Google.
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim()
  const clientEmail = process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL?.trim()
  const privateKey = process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim().replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase service account is not configured: set FIREBASE_SERVICE_ACCOUNT_EMAIL and FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY'
    )
  }

  return {projectId, clientEmail, privateKey}
}

function base64UrlEncode(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

// Импорт ключа стоит заметного времени, поэтому держим его в изоляте.
let cachedSigningKey: Promise<CryptoKey> | undefined

function getSigningKey(privateKey: string): Promise<CryptoKey> {
  if (!cachedSigningKey) {
    cachedSigningKey = crypto.subtle.importKey(
      'pkcs8',
      pemToPkcs8(privateKey),
      {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'},
      false,
      ['sign']
    )
  }
  return cachedSigningKey
}

async function signJwt(claims: Record<string, unknown>, privateKey: string): Promise<string> {
  const header = base64UrlEncode(JSON.stringify({alg: 'RS256', typ: 'JWT'}))
  const payload = base64UrlEncode(JSON.stringify(claims))
  const signingInput = `${header}.${payload}`

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    await getSigningKey(privateKey),
    new TextEncoder().encode(signingInput)
  )

  return `${signingInput}.${base64UrlEncode(signature)}`
}

interface CachedAccessToken {
  token: string
  expiresAtSeconds: number
}

let cachedAccessToken: CachedAccessToken | undefined
let pendingAccessToken: Promise<string> | undefined

async function requestAccessToken(scope: string): Promise<string> {
  const {clientEmail, privateKey} = getServiceAccount()
  const issuedAt = Math.floor(Date.now() / 1000)

  const assertion = await signJwt(
    {
      iss: clientEmail,
      scope,
      aud: TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + ACCESS_TOKEN_LIFETIME_SECONDS
    },
    privateKey
  )

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({grant_type: JWT_GRANT_TYPE, assertion})
  })

  if (!response.ok) {
    throw new Error(`Google token endpoint responded ${response.status}: ${await response.text()}`)
  }

  const data = (await response.json()) as {access_token: string; expires_in: number}
  cachedAccessToken = {
    token: data.access_token,
    expiresAtSeconds: issuedAt + data.expires_in - ACCESS_TOKEN_REFRESH_MARGIN_SECONDS
  }
  return data.access_token
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/datastore',
  'https://www.googleapis.com/auth/firebase',
  'https://www.googleapis.com/auth/identitytoolkit'
].join(' ')

/**
 * OAuth-токен сервис-аккаунта для Firestore и Identity Toolkit.
 * Кэшируется в изоляте до истечения; параллельные вызовы делят один запрос,
 * чтобы всплеск запросов не превратился в всплеск обращений к Google.
 */
export async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedAccessToken && cachedAccessToken.expiresAtSeconds > now) {
    return cachedAccessToken.token
  }

  if (!pendingAccessToken) {
    pendingAccessToken = requestAccessToken(REQUIRED_SCOPES).finally(() => {
      pendingAccessToken = undefined
    })
  }

  return pendingAccessToken
}
