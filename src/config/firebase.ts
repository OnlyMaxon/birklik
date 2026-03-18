import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// Firebase configuration
// Replace with your own Firebase config from Firebase Console
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDdWTip4DznmrrFH9WdH4EqSKeByKMaMzI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "birklik-65289.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "birklik-65289",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "birklik-65289.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "695765296567",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:695765296567:web:e4864e9226fb279686f432"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize services
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

export default app
