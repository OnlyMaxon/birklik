// functions/src/cleanup/firestore-cleanup.ts
import {admin} from '../firebase-admin';
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
 * Сколько часов платёж в статусе awaiting_payment считается живым.
 * MPI-сессия банка живёт 1 час, сутки — запас на задержанный колбэк.
 * Дальше платёж мёртв: колбэк уже не придёт, и держать драфт незачем.
 */
export const PAYMENT_GRACE_HOURS = 24;

/** Возраст документа в часах по полю createdAt (Timestamp либо ISO-строка). */
function ageInHours(createdAt: any): number {
  if (!createdAt) return Infinity; // без даты считаем протухшим
  const date = createdAt?.toDate?.() ?? new Date(createdAt);
  const ms = date.getTime();
  if (Number.isNaN(ms)) return Infinity;
  return (Date.now() - ms) / 3600000;
}

/**
 * Скрывает объявления с истёкшим premium/VIP: status → inactive, expiredAt = now.
 * listingTier и premiumExpiresAt/vipExpiresAt НЕ трогаем — нужны для кнопки "Продлить".
 * Через 30 дней cleanupInactiveListings удалит их насовсем.
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
      .where('status', '==', 'active')
      .limit(CLEANUP_RULES.maxDeletesPerRun)
      .get();

    for (const doc of premiumQuery.docs) {
      batch.update(doc.ref, {
        status: 'inactive',
        expiredAt: now,
      });
      deletedIds.push(doc.id);
      count++;
    }

    const vipQuery = await admin
      .firestore()
      .collection('properties')
      .where('listingTier', '==', 'vip')
      .where('vipExpiresAt', '<', now)
      .where('status', '==', 'active')
      .limit(CLEANUP_RULES.maxDeletesPerRun)
      .get();

    for (const doc of vipQuery.docs) {
      batch.update(doc.ref, {
        status: 'inactive',
        expiredAt: now,
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
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

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
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

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

/**
 * Удаляет объявления со статусом 'inactive', которые не были продлены 30+ дней.
 * expiredAt — ISO-строка, проставляется cleanupExpiredPremium при деактивации.
 */
export async function cleanupInactiveListings(): Promise<CleanupLog> {
  const startTime = Date.now();
  const deletedIds: string[] = [];
  let count = 0;

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const query = await admin
      .firestore()
      .collection('properties')
      .where('status', '==', 'inactive')
      .where('expiredAt', '<', thirtyDaysAgo)
      .limit(CLEANUP_RULES.maxDeletesPerRun)
      .get();

    // Собираем URLs изображений ДО удаления документов
    const imagesByProp = new Map<string, string[]>();
    for (const doc of query.docs) {
      imagesByProp.set(doc.id, doc.data().images || []);
    }

    const batch = admin.firestore().batch();
    for (const doc of query.docs) {
      batch.delete(doc.ref);
      deletedIds.push(doc.id);
      count++;
    }

    if (count > 0) {
      await batch.commit();
      const bucket = admin.storage().bucket();
      for (const [, images] of imagesByProp) {
        for (const url of images) {
          try {
            const match = url.match(/\/o\/(.+?)\?/);
            if (!match) continue;
            await bucket.file(decodeURIComponent(match[1])).delete();
          } catch { /* файл уже удалён */ }
        }
      }
    }

    return { timestamp: new Date(), type: 'inactive_listings', status: 'success', count, deletedIds, duration: Date.now() - startTime };
  } catch (error: any) {
    console.error('[ERROR] cleanupInactiveListings:', error);
    return { timestamp: new Date(), type: 'inactive_listings', status: 'failed', count, deletedIds, error: error.message, duration: Date.now() - startTime };
  }
}

/**
 * Переводит зависшие awaiting_payment в 'expired'.
 *
 * Из awaiting_payment платёж выходит только по колбэку банка. Если колбэк не
 * пришёл (пользователь закрыл вкладку, банк не ответил), запись висит вечно —
 * а вместе с ней бессмертен и драфт, который на неё завязан.
 *
 * Фильтр по возрасту сделан в коде, а не третьим where: иначе Firestore
 * потребует новый составной индекс.
 */
export async function expireStalePayments(): Promise<CleanupLog> {
  const startTime = Date.now();
  const deletedIds: string[] = [];

  try {
    const snap = await admin
      .firestore()
      .collection('payments')
      .where('status', '==', 'awaiting_payment')
      .limit(CLEANUP_RULES.maxDeletesPerRun)
      .get();

    const stale = snap.docs.filter((d) => ageInHours(d.data().createdAt) > PAYMENT_GRACE_HOURS);

    if (stale.length > 0) {
      const batch = admin.firestore().batch();
      for (const doc of stale) {
        batch.update(doc.ref, {
          status: 'expired',
          expiredAt: new Date().toISOString(),
        });
        deletedIds.push(doc.id);
      }
      await batch.commit();
    }

    console.log(`[Cleanup] stale payments expired: ${deletedIds.length}`);
    return { timestamp: new Date(), type: 'stale_payments', status: 'success', count: deletedIds.length, deletedIds, duration: Date.now() - startTime };
  } catch (error: any) {
    console.error('[ERROR] expireStalePayments:', error);
    return { timestamp: new Date(), type: 'stale_payments', status: 'failed', count: deletedIds.length, deletedIds, error: error.message, duration: Date.now() - startTime };
  }
}

// Удаляет draft-объявления старше 2 часов — брошенные без инициации оплаты.
// Drafts с активным awaiting_payment пропускаются: callback может ещё не дойти.
// MPI-сессия банка = 1 час; cleanup = 2 часа — достаточный запас,
// но callback задержан или не отправлен банком → пропертя должна выжить.
//
// Защита действует не бесконечно, а PAYMENT_GRACE_HOURS: платёж выходит из
// awaiting_payment только по колбэку банка, и если тот не пришёл, драфт вместе
// с фотографиями оставался бы в базе навсегда. Проверка возраста продублирована
// здесь намеренно — expireStalePayments может не успеть отработать.
export async function cleanupOrphanedDrafts(): Promise<CleanupLog> {
  const startTime = Date.now();
  const deletedIds: string[] = [];

  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const snap = await admin.firestore()
      .collection('properties')
      .where('status', '==', 'draft')
      .where('createdAt', '<', twoHoursAgo)
      .limit(CLEANUP_RULES.maxDeletesPerRun)
      .get();

    const imagesByProp = new Map<string, string[]>();

    for (const doc of snap.docs) {
      // Проверяем наличие активного платежа ДО любого удаления
      const activePayment = await admin.firestore()
        .collection('payments')
        .where('propertyId', '==', doc.id)
        .where('status', '==', 'awaiting_payment')
        .get();

      const pending = activePayment.docs.filter(
        (p) => ageInHours(p.data().createdAt) <= PAYMENT_GRACE_HOURS
      );

      if (pending.length > 0) {
        console.warn(`[Cleanup] Skip draft ${doc.id}: has active awaiting_payment (MPI callback may be pending)`);
        continue;
      }

      // Платежи есть, но все протухли — помечаем, чтобы не висели вечно
      for (const p of activePayment.docs) {
        await p.ref.update({ status: 'expired', expiredAt: new Date().toISOString() });
        console.warn(`[Cleanup] Payment ${p.id} expired: no callback within ${PAYMENT_GRACE_HOURS}h`);
      }

      imagesByProp.set(doc.id, doc.data().images || []);
      deletedIds.push(doc.id);
    }

    if (deletedIds.length > 0) {
      const batch = admin.firestore().batch();
      deletedIds.forEach(id => {
        batch.delete(admin.firestore().collection('properties').doc(id));
      });
      await batch.commit();

      const bucket = admin.storage().bucket();
      for (const [, images] of imagesByProp) {
        for (const url of images) {
          try {
            const match = url.match(/\/o\/(.+?)\?/);
            if (!match) continue;
            await bucket.file(decodeURIComponent(match[1])).delete();
          } catch { /* файл уже удалён */ }
        }
      }
    }

    console.log(`[Cleanup] Orphaned drafts deleted: ${deletedIds.length}`);
    return { timestamp: new Date(), type: 'orphaned_drafts', status: 'success', count: deletedIds.length, deletedIds, duration: Date.now() - startTime };
  } catch (error) {
    console.error('[Cleanup] orphaned_drafts failed:', error);
    return { timestamp: new Date(), type: 'orphaned_drafts', status: 'failed', count: 0, deletedIds, error: (error as any).message, duration: Date.now() - startTime };
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
    cleanupInactiveListings(),
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
