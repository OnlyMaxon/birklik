// functions/src/cleanup/firestore-cleanup.ts
import * as admin from 'firebase-admin';
import { validateSafeDelete, CLEANUP_RULES } from '../utils/cleanup-safety';

interface CleanupLog {
  timestamp: Date;
  type: string;
  status: 'success' | 'failed' | 'partial';
  count: number;
  deletedIds: string[];
  error?: string;
  duration: number;
}

/**
 * Снимает premium/vip статус с истёкших объявлений.
 * Коллекция: properties. Поля: listingTier, premiumExpiresAt, vipExpiresAt (ISO-строки).
 */
export async function cleanupExpiredPremium(): Promise<CleanupLog> {
  const startTime = Date.now();
  const deletedIds: string[] = [];
  let count = 0;

  try {
    const now = new Date().toISOString();
    const batch = admin.firestore().batch();

    const premiumQuery = await admin
      .firestore()
      .collection('properties')
      .where('listingTier', '==', 'premium')
      .where('premiumExpiresAt', '<', now)
      .limit(CLEANUP_RULES.maxDeletesPerRun)
      .get();

    for (const doc of premiumQuery.docs) {
      batch.update(doc.ref, {
        listingTier: 'standard',
        premiumExpiresAt: admin.firestore.FieldValue.delete(),
      });
      deletedIds.push(doc.id);
      count++;
    }

    const vipQuery = await admin
      .firestore()
      .collection('properties')
      .where('listingTier', '==', 'vip')
      .where('vipExpiresAt', '<', now)
      .limit(CLEANUP_RULES.maxDeletesPerRun)
      .get();

    for (const doc of vipQuery.docs) {
      batch.update(doc.ref, {
        listingTier: 'standard',
        vipExpiresAt: admin.firestore.FieldValue.delete(),
      });
      deletedIds.push(doc.id);
      count++;
    }

    if (count > 0) {
      await batch.commit();
    }

    return { timestamp: new Date(), type: 'expired_premium', status: 'success', count, deletedIds, duration: Date.now() - startTime };
  } catch (error: any) {
    console.error('[ERROR] cleanupExpiredPremium:', error);
    return { timestamp: new Date(), type: 'expired_premium', status: 'failed', count, deletedIds, error: error.message, duration: Date.now() - startTime };
  }
}

/**
 * Удаляет pending-объявления старше 30 дней (зависшие без модерации).
 * Коллекция: properties. Статус 'pending' — ожидает модерацию.
 */
export async function cleanupStalePendingListings(): Promise<CleanupLog> {
  const startTime = Date.now();
  const deletedIds: string[] = [];
  let count = 0;

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const query = await admin
      .firestore()
      .collection('properties')
      .where('status', '==', 'pending')
      .where('createdAt', '<', thirtyDaysAgo)
      .limit(CLEANUP_RULES.maxDeletesPerRun)
      .get();

    const batch = admin.firestore().batch();

    for (const doc of query.docs) {
      const validation = await validateSafeDelete('properties', doc.data());
      if (!validation.safe) {
        console.warn(`[SKIP] ${doc.id}: ${validation.reason}`);
        continue;
      }
      batch.delete(doc.ref);
      deletedIds.push(doc.id);
      count++;
    }

    if (count > 0) {
      await batch.commit();
      for (const id of deletedIds) {
        await deletePropertyImages(id);
      }
    }

    return { timestamp: new Date(), type: 'stale_pending_listings', status: 'success', count, deletedIds, duration: Date.now() - startTime };
  } catch (error: any) {
    console.error('[ERROR] cleanupStalePendingListings:', error);
    return { timestamp: new Date(), type: 'stale_pending_listings', status: 'failed', count, deletedIds, error: error.message, duration: Date.now() - startTime };
  }
}

/**
 * Удаляет отклонённые бронирования старше 30 дней.
 * Коллекция: bookings. Статус 'rejected' существует в схеме.
 */
export async function cleanupRejectedBookings(): Promise<CleanupLog> {
  const startTime = Date.now();
  const deletedIds: string[] = [];
  let count = 0;

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const query = await admin
      .firestore()
      .collection('bookings')
      .where('status', '==', 'rejected')
      .where('createdAt', '<', thirtyDaysAgo)
      .limit(CLEANUP_RULES.maxDeletesPerRun)
      .get();

    const batch = admin.firestore().batch();
    for (const doc of query.docs) {
      batch.delete(doc.ref);
      deletedIds.push(doc.id);
      count++;
    }
    if (count > 0) await batch.commit();

    return { timestamp: new Date(), type: 'rejected_bookings', status: 'success', count, deletedIds, duration: Date.now() - startTime };
  } catch (error: any) {
    console.error('[ERROR] cleanupRejectedBookings:', error);
    return { timestamp: new Date(), type: 'rejected_bookings', status: 'failed', count, deletedIds, error: error.message, duration: Date.now() - startTime };
  }
}

/**
 * Удаляет отменённые бронирования старше 90 дней.
 */
export async function cleanupCancelledBookings(): Promise<CleanupLog> {
  const startTime = Date.now();
  const deletedIds: string[] = [];
  let count = 0;

  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const query = await admin
      .firestore()
      .collection('bookings')
      .where('status', '==', 'cancelled')
      .where('createdAt', '<', ninetyDaysAgo)
      .limit(CLEANUP_RULES.maxDeletesPerRun)
      .get();

    const batch = admin.firestore().batch();
    for (const doc of query.docs) {
      batch.delete(doc.ref);
      deletedIds.push(doc.id);
      count++;
    }
    if (count > 0) await batch.commit();

    return { timestamp: new Date(), type: 'cancelled_bookings', status: 'success', count, deletedIds, duration: Date.now() - startTime };
  } catch (error: any) {
    console.error('[ERROR] cleanupCancelledBookings:', error);
    return { timestamp: new Date(), type: 'cancelled_bookings', status: 'failed', count, deletedIds, error: error.message, duration: Date.now() - startTime };
  }
}

/**
 * Удаляет тестовые объявления (isTest: true) старше 7 дней.
 */
export async function cleanupTestData(): Promise<CleanupLog> {
  const startTime = Date.now();
  const deletedIds: string[] = [];
  let count = 0;

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const query = await admin
      .firestore()
      .collection('properties')
      .where('isTest', '==', true)
      .where('createdAt', '<', sevenDaysAgo)
      .limit(CLEANUP_RULES.maxDeletesPerRun)
      .get();

    const batch = admin.firestore().batch();
    for (const doc of query.docs) {
      batch.delete(doc.ref);
      deletedIds.push(doc.id);
      count++;
    }
    if (count > 0) {
      await batch.commit();
      for (const id of deletedIds) {
        await deletePropertyImages(id);
      }
    }

    return { timestamp: new Date(), type: 'test_data', status: 'success', count, deletedIds, duration: Date.now() - startTime };
  } catch (error: any) {
    console.error('[ERROR] cleanupTestData:', error);
    return { timestamp: new Date(), type: 'test_data', status: 'failed', count, deletedIds, error: error.message, duration: Date.now() - startTime };
  }
}

/**
 * Удаляет изображения объявления из Storage по URL-ссылкам в документе.
 * URL формат: https://.../o/properties%2F{userId}%2F{filename}?...
 */
async function deletePropertyImages(propertyId: string): Promise<void> {
  try {
    const doc = await admin.firestore().collection('properties').doc(propertyId).get();
    if (!doc.exists) return;

    const images: string[] = doc.data()?.images || [];
    const bucket = admin.storage().bucket();

    for (const url of images) {
      try {
        const match = url.match(/\/o\/(.+?)\?/);
        if (!match) continue;
        const filePath = decodeURIComponent(match[1]);
        await bucket.file(filePath).delete();
      } catch {
        // Файл уже удалён — игнорируем
      }
    }
  } catch (error) {
    console.warn(`[WARN] Failed to delete images for property ${propertyId}:`, error);
  }
}

export async function logCleanupResult(log: CleanupLog): Promise<void> {
  try {
    await admin.firestore().collection('cleanup-logs').add(log);
  } catch (error) {
    console.error('[ERROR] Failed to log cleanup result:', error);
  }
}

export async function runAllCleanups(): Promise<CleanupLog[]> {
  console.log('[INFO] Starting weekly Firestore cleanup...');

  const settled = await Promise.allSettled([
    cleanupExpiredPremium(),
    cleanupStalePendingListings(),
    cleanupRejectedBookings(),
    cleanupCancelledBookings(),
    cleanupTestData(),
  ]);

  const results: CleanupLog[] = [];
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      results.push(result.value);
      await logCleanupResult(result.value);
    } else {
      console.error('[ERROR] Cleanup task failed:', result.reason);
    }
  }

  console.log('[INFO] Firestore cleanup done:', results.map(r => `${r.type}:${r.count}`).join(', '));
  return results;
}
