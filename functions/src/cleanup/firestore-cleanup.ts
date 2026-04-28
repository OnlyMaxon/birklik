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
  duration: number; // в миллисекундах
}

/**
 * Очистка истекших premium listings
 */
export async function cleanupExpiredPremium(): Promise<CleanupLog> {
  const startTime = Date.now();
  const deletedIds: string[] = [];
  let count = 0;

  try {
    const now = new Date();
    const query = await admin
      .firestore()
      .collection('listings')
      .where('status', '==', 'active')
      .where('premiumExpiry', '<', now)
      .limit(CLEANUP_RULES.maxDeletesPerRun)
      .get();

    const batch = admin.firestore().batch();

    for (const doc of query.docs) {
      const validation = await validateSafeDelete('listings', doc.data());

      if (!validation.safe) {
        console.warn(`[SKIP] ${doc.id}: ${validation.reason}`);
        continue;
      }

      // Обновляем вместо удаления - только убираем premium
      batch.update(doc.ref, {
        premium: false,
        premiumExpiry: admin.firestore.FieldValue.delete(),
        premiumRemovedAt: new Date(),
      });

      deletedIds.push(doc.id);
      count++;
    }

    if (count > 0) {
      await batch.commit();
    }

    return {
      timestamp: new Date(),
      type: 'expired_premium',
      status: 'success',
      count,
      deletedIds,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    console.error('[ERROR] cleanupExpiredPremium:', error);
    return {
      timestamp: new Date(),
      type: 'expired_premium',
      status: 'failed',
      count,
      deletedIds,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Очистка старых черновиков
 */
export async function cleanupDraftListings(): Promise<CleanupLog> {
  const startTime = Date.now();
  const deletedIds: string[] = [];
  let count = 0;

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const query = await admin
      .firestore()
      .collection('listings')
      .where('status', '==', 'draft')
      .where('lastUpdated', '<', thirtyDaysAgo)
      .limit(CLEANUP_RULES.maxDeletesPerRun)
      .get();

    const batch = admin.firestore().batch();

    for (const doc of query.docs) {
      const validation = await validateSafeDelete('listings', doc.data());

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

      // Удаляем images из storage
      for (const id of deletedIds) {
        await deleteListingImages(id);
      }
    }

    return {
      timestamp: new Date(),
      type: 'draft_listings',
      status: 'success',
      count,
      deletedIds,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    console.error('[ERROR] cleanupDraftListings:', error);
    return {
      timestamp: new Date(),
      type: 'draft_listings',
      status: 'failed',
      count,
      deletedIds,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Очистка неудачных bookings
 */
export async function cleanupFailedBookings(): Promise<CleanupLog> {
  const startTime = Date.now();
  const deletedIds: string[] = [];
  let count = 0;

  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const query = await admin
      .firestore()
      .collection('bookings')
      .where('status', '==', 'failed')
      .where('createdAt', '<', fourteenDaysAgo)
      .limit(CLEANUP_RULES.maxDeletesPerRun)
      .get();

    const batch = admin.firestore().batch();

    for (const doc of query.docs) {
      const validation = await validateSafeDelete('bookings', doc.data());

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
    }

    return {
      timestamp: new Date(),
      type: 'failed_bookings',
      status: 'success',
      count,
      deletedIds,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    console.error('[ERROR] cleanupFailedBookings:', error);
    return {
      timestamp: new Date(),
      type: 'failed_bookings',
      status: 'failed',
      count,
      deletedIds,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Очистка тестовых данных
 */
export async function cleanupTestData(): Promise<CleanupLog> {
  const startTime = Date.now();
  const deletedIds: string[] = [];
  let count = 0;

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const query = await admin
      .firestore()
      .collection('listings')
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

      // Удаляем images из storage
      for (const id of deletedIds) {
        await deleteListingImages(id);
      }
    }

    return {
      timestamp: new Date(),
      type: 'test_data',
      status: 'success',
      count,
      deletedIds,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    console.error('[ERROR] cleanupTestData:', error);
    return {
      timestamp: new Date(),
      type: 'test_data',
      status: 'failed',
      count,
      deletedIds,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Удаляет все изображения листинга из Storage
 */
async function deleteListingImages(propertyId: string): Promise<void> {
  try {
    const bucket = admin.storage().bucket();
    const prefix = `properties/${propertyId}/`;

    const [files] = await bucket.getFiles({ prefix });

    for (const file of files) {
      await file.delete();
    }
  } catch (error) {
    console.warn(`[WARN] Failed to delete images for ${propertyId}:`, error);
  }
}

/**
 * Логирует результаты cleanup в Firestore
 */
export async function logCleanupResult(log: CleanupLog): Promise<void> {
  try {
    await admin.firestore().collection('cleanup-logs').add(log);
  } catch (error) {
    console.error('[ERROR] Failed to log cleanup result:', error);
  }
}

/**
 * Запускает все cleanup функции
 */
export async function runAllCleanups(): Promise<CleanupLog[]> {
  console.log('[INFO] Starting weekly cleanup...');

  const results: CleanupLog[] = [];

  // Запускаем все cleanup функции
  const cleanups = [
    cleanupExpiredPremium(),
    cleanupDraftListings(),
    cleanupFailedBookings(),
    cleanupTestData(),
  ];

  const logs = await Promise.allSettled(cleanups);

  for (const result of logs) {
    if (result.status === 'fulfilled') {
      results.push(result.value);
      await logCleanupResult(result.value);
    } else {
      console.error('[ERROR] Cleanup failed:', result.reason);
    }
  }

  console.log('[INFO] Cleanup completed:', results);
  return results;
}
