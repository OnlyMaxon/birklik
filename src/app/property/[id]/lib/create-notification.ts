import 'server-only'
import {adminDb} from '@/lib/firebase/admin'
import type {Notification} from '@/types'

export async function createNotification<T extends Omit<Notification, 'id' | 'createdAt'>>(userId: string, data: T): Promise<void> {
  await adminDb
    .collection('users')
    .doc(userId)
    .collection('notifications')
    .add({...data, createdAt: new Date().toISOString()})
}
