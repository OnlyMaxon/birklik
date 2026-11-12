import {cert, initializeApp} from 'firebase-admin/app'
import {getAuth} from 'firebase-admin/auth'
import {FieldValue, Timestamp, getFirestore} from 'firebase-admin/firestore'
import {getMessaging} from 'firebase-admin/messaging'
import {getStorage} from 'firebase-admin/storage'

// Firebase Admin 14 removed the legacy namespace API. Keep the existing
// Functions code stable while routing it through the modular SDK.
// `Timestamp` добавлен 2026-11-12: счётчик выручки читает дату платежа из
// журнала, а там лежат и `Timestamp`, и строки ISO — отличать их надо по типу.
const firestore = Object.assign(getFirestore, {FieldValue, Timestamp})

export const admin = {
  initializeApp,
  credential: {cert},
  auth: getAuth,
  firestore,
  messaging: getMessaging,
  storage: getStorage,
}
