import { collection, getDocs } from 'firebase/firestore'
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

/**
 * Все пользователи для вкладки «Люди», свежие сверху.
 *
 * Сортировка сделана в памяти намеренно. `orderBy('createdAt')` молча
 * выбрасывает документы, у которых поля нет вовсе, — так один профиль из 134 в
 * боевой базе не показывался на вкладке совсем. Тот же капкан уже обойдён в
 * `getAllBookings`.
 */
export const getAllUsers = async (): Promise<UserRecord[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'users'))
    return snapshot.docs
      .map(doc => {
        const user = { id: doc.id, ...doc.data() } as UserRecord
        return {...user, avatar: toImageApiUrl(user.avatar)}
      })
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  } catch {
    return []
  }
}
