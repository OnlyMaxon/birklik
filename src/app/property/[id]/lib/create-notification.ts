import 'server-only'
import {addDoc} from '@/lib/firebase/firestore-rest'
import type {Notification} from '@/types'

export async function createNotification<T extends Omit<Notification, 'id' | 'createdAt'>>(userId: string, data: T): Promise<void> {
  await addDoc(`users/${userId}/notifications`, {...data, createdAt: new Date().toISOString()})
}
