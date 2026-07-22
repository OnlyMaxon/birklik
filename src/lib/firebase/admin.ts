import 'server-only'
import {cert, getApps, getApp, initializeApp} from 'firebase-admin/app'
import {getAuth} from 'firebase-admin/auth'
import {getFirestore} from 'firebase-admin/firestore'
import {getStorage} from 'firebase-admin/storage'

function loadCredential() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin SDK is not configured: set FIREBASE_SERVICE_ACCOUNT_EMAIL and FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY'
    )
  }

  return cert({projectId, clientEmail, privateKey})
}

const app = getApps().length > 0
  ? getApp()
  : initializeApp({
      credential: loadCredential(),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    })

export const adminAuth = getAuth(app)
export const adminDb = getFirestore(app)
export const adminStorage = getStorage(app)
