import {cert, initializeApp} from 'firebase-admin/app'
import {FieldValue, getFirestore} from 'firebase-admin/firestore'
import {getMessaging} from 'firebase-admin/messaging'
import {getStorage} from 'firebase-admin/storage'

// Firebase Admin 14 removed the legacy namespace API. Keep the existing
// Functions code stable while routing it through the modular SDK.
const firestore = Object.assign(getFirestore, {FieldValue})

export const admin = {
  initializeApp,
  credential: {cert},
  firestore,
  messaging: getMessaging,
  storage: getStorage,
}
