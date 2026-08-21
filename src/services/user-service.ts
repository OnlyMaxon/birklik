import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../lib/firebase/client'
import {toImageApiUrl} from '../lib/images'

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
    return snapshot.docs.map(doc => {
      const user = { id: doc.id, ...doc.data() } as UserRecord
      return {...user, avatar: toImageApiUrl(user.avatar)}
    })
  } catch {
    return []
  }
}
