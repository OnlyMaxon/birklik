// functions/src/cleanup/storage-cleanup.ts
import * as admin from 'firebase-admin';

interface StorageCleanupLog {
  timestamp: Date;
  type: string;
  status: 'success' | 'failed' | 'partial';
  count: number;
  deletedFiles: string[];
  error?: string;
  duration: number;
}

/**
 * Удаляет orphaned images (изображения без ссылки в документе)
 */
export async function cleanupOrphanedImages(): Promise<StorageCleanupLog> {
  const startTime = Date.now();
  const deletedFiles: string[] = [];
  let count = 0;

  try {
    const bucket = admin.storage().bucket();
    const db = admin.firestore();

    // Получаем все files из properties папки
    const [files] = await bucket.getFiles({ prefix: 'properties/' });

    for (const file of files) {
      try {
        const path = file.name;
        // Формат: properties/{userId}/{propertyId}/...
        const parts = path.split('/');

        if (parts.length < 4) continue; // Skip если неправильный формат

        const propertyId = parts[2];

        // Проверяем существует ли этот listing в Firestore
        const listingDoc = await db.collection('listings').doc(propertyId).get();

        if (!listingDoc.exists) {
          // Listing удален - удаляем image
          await file.delete();
          deletedFiles.push(path);
          count++;

          if (count >= 100) {
            break; // Максимум 100 файлов за раз
          }
        }
      } catch (error) {
        console.warn(`[WARN] Error checking file ${file.name}:`, error);
      }
    }

    return {
      timestamp: new Date(),
      type: 'orphaned_images',
      status: 'success',
      count,
      deletedFiles,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    console.error('[ERROR] cleanupOrphanedImages:', error);
    return {
      timestamp: new Date(),
      type: 'orphaned_images',
      status: 'failed',
      count,
      deletedFiles,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Удаляет старые временные файлы (temp uploads)
 */
export async function cleanupTempFiles(): Promise<StorageCleanupLog> {
  const startTime = Date.now();
  const deletedFiles: string[] = [];
  let count = 0;

  try {
    const bucket = admin.storage().bucket();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Получаем все files из temp папки
    const [files] = await bucket.getFiles({ prefix: 'temp/' });

    for (const file of files) {
      try {
        const [metadata] = await file.getMetadata();

        // Проверяем возраст файла
        const updatedTime = new Date(metadata.updated);

        if (updatedTime < oneDayAgo) {
          await file.delete();
          deletedFiles.push(file.name);
          count++;

          if (count >= 100) {
            break;
          }
        }
      } catch (error) {
        console.warn(`[WARN] Error processing temp file:`, error);
      }
    }

    return {
      timestamp: new Date(),
      type: 'temp_files',
      status: 'success',
      count,
      deletedFiles,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    console.error('[ERROR] cleanupTempFiles:', error);
    return {
      timestamp: new Date(),
      type: 'temp_files',
      status: 'failed',
      count,
      deletedFiles,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Удаляет старые user avatars без обновлений > 1 года
 */
export async function cleanupOldAvatars(): Promise<StorageCleanupLog> {
  const startTime = Date.now();
  const deletedFiles: string[] = [];
  let count = 0;

  try {
    const bucket = admin.storage().bucket();
    const db = admin.firestore();
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    // Получаем все avatars
    const [files] = await bucket.getFiles({ prefix: 'avatars/' });

    for (const file of files) {
      try {
        const [metadata] = await file.getMetadata();
        const updatedTime = new Date(metadata.updated);

        // Если avatar старше 1 года и нет обновлений в user документе
        if (updatedTime < oneYearAgo) {
          const userId = file.name.split('/')[1];

          const userDoc = await db.collection('users').doc(userId).get();

          if (!userDoc.exists || !userDoc.data().avatar) {
            await file.delete();
            deletedFiles.push(file.name);
            count++;

            if (count >= 50) {
              break;
            }
          }
        }
      } catch (error) {
        console.warn(`[WARN] Error processing avatar:`, error);
      }
    }

    return {
      timestamp: new Date(),
      type: 'old_avatars',
      status: 'success',
      count,
      deletedFiles,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    console.error('[ERROR] cleanupOldAvatars:', error);
    return {
      timestamp: new Date(),
      type: 'old_avatars',
      status: 'failed',
      count,
      deletedFiles,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Логирует результаты storage cleanup
 */
export async function logStorageCleanupResult(
  log: StorageCleanupLog
): Promise<void> {
  try {
    await admin.firestore().collection('cleanup-logs').add(log);
  } catch (error) {
    console.error('[ERROR] Failed to log storage cleanup:', error);
  }
}

/**
 * Запускает все storage cleanup функции
 */
export async function runAllStorageCleanups(): Promise<StorageCleanupLog[]> {
  console.log('[INFO] Starting storage cleanup...');

  const results: StorageCleanupLog[] = [];

  const cleanups = [
    cleanupOrphanedImages(),
    cleanupTempFiles(),
    cleanupOldAvatars(),
  ];

  const logs = await Promise.allSettled(cleanups);

  for (const result of logs) {
    if (result.status === 'fulfilled') {
      results.push(result.value);
      await logStorageCleanupResult(result.value);
    } else {
      console.error('[ERROR] Storage cleanup failed:', result.reason);
    }
  }

  console.log('[INFO] Storage cleanup completed:', results);
  return results;
}
