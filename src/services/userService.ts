import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../config/firebase'

export interface UserRecord {
  id: string
  name: string
  email: string
  phone: string
  avatar?: string
  createdAt: string
}

export const getAllUsers = async (): Promise<UserRecord[]> => {
  try {
    const usersRef = collection(db, 'users')
    const q = query(usersRef, orderBy('createdAt', 'desc'))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserRecord))
  } catch {
    return []
  }
}
