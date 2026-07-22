import {getApp, getApps, initializeApp} from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getMessaging, isSupported } from 'firebase/messaging'
import {initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider} from 'firebase/app-check'

// Firebase configuration - from environment variables only
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
}

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)

// App Check — protects Firestore, Storage and Functions from unauthorized access
// In dev mode a debug token is printed to the console — add it in Firebase Console -> App Check -> Apps -> Debug tokens
type AppCheckGlobal = typeof globalThis & {
  FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string
  __birklikAppCheckInitialized?: boolean
}

export function initializeFirebaseAppCheck() {
  if (typeof window === 'undefined') return

  const browserGlobal = globalThis as AppCheckGlobal
  if (browserGlobal.__birklikAppCheckInitialized) return

  const enterpriseSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY
  const siteKey = enterpriseSiteKey ?? process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
  if (!siteKey) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[Security] App Check not initialized: NEXT_PUBLIC_RECAPTCHA_SITE_KEY is missing')
    }
    return
  }

  const debugToken = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN
  if (debugToken) {
    browserGlobal.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken === 'true' ? true : debugToken
  }

  initializeAppCheck(app, {
    provider: enterpriseSiteKey
      ? new ReCaptchaEnterpriseProvider(enterpriseSiteKey)
      : new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true
  })
  browserGlobal.__birklikAppCheckInitialized = true
}

// Initialize services
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

// Messaging — only in browser environments that support it
export const getFirebaseMessaging = async () => {
  const supported = await isSupported()
  if (!supported) return null
  return getMessaging(app)
}

export default app
