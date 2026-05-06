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
 * Удаляет orphaned изображения объявлений.
 *
 * Реальный путь в Storage: properties/{userId}/{timestamp}_{filename}
 * propertyId в пути НЕ хранится, поэтому логика:
 * 1. Группируем файлы по userId (parts[1])
 * 2. Для каждого userId получаем все его объявления из Firestore
 * 3. Собираем все URL изображений из этих объявлений
 * 4. Файлы старше 7 дней, URL которых нет ни в одном объявлении — orphaned
 */
export async function cleanupOrphanedImages(): Promise<StorageCleanupLog> {
  const startTime = Date.now();
  const deletedFiles: string[] = [];
  let count = 0;

  try {
    const bucket = admin.storage().bucket();
    const db = admin.firestore();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [files] = await bucket.getFiles({ prefix: 'properties/' });

    // Группируем файлы по userId (parts[1])
    const filesByUser = new Map<string, typeof files>();
    for (const file of files) {
      const parts = file.name.split('/');
      // Ожидаем минимум: properties/{userId}/{filename}
      if (parts.length < 3) continue;
      const userId = parts[1];
      if (!filesByUser.has(userId)) filesByUser.set(userId, []);
      filesByUser.get(userId)!.push(file);
    }

    for (const [userId, userFiles] of filesByUser) {
      if (count >= 100) break;

      // Получаем все объявления этого пользователя
      const propertiesSnap = await db
        .collection('properties')
        .where('ownerId', '==', userId)
        .get();

      // Собираем все URL изображений из всех объявлений пользователя
      const referencedUrls = new Set<string>();
      for (const doc of propertiesSnap.docs) {
        const images: string[] = doc.data().images || [];
        for (const url of images) referencedUrls.add(url);
      }

      for (const file of userFiles) {
        if (count >= 100) break;

        try {
          const [metadata] = await file.getMetadata();
          const updatedAt = new Date(metadata.updated as string);

          // Пропускаем свежие файлы (могут ещё не быть привязаны)
          if (updatedAt > sevenDaysAgo) continue;

          // Проверяем: есть ли URL этого файла в каком-либо объявлении
          const encodedPath = file.name.split('/').map(encodeURIComponent).join('/');
          const isReferenced = [...referencedUrls].some(
            (url) => url.includes(encodedPath) || url.includes(encodeURIComponent(file.name))
          );

          if (!isReferenced) {
            await file.delete();
            deletedFiles.push(file.name);
            count++;
          }
        } catch (err) {
          console.warn(`[WARN] Error processing file ${file.name}:`, err);
        }
      }
    }

    return { timestamp: new Date(), type: 'orphaned_images', status: 'success', count, deletedFiles, duration: Date.now() - startTime };
  } catch (error: any) {
    console.error('[ERROR] cleanupOrphanedImages:', error);
    return { timestamp: new Date(), type: 'orphaned_images', status: 'failed', count, deletedFiles, error: error.message, duration: Date.now() - startTime };
  }
}

/**
 * Удаляет временные файлы старше 24 часов из папки temp/.
 */
export async function cleanupTempFiles(): Promise<StorageCleanupLog> {
  const startTime = Date.now();
  const deletedFiles: string[] = [];
  let count = 0;

  try {
    const bucket = admin.storage().bucket();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [files] = await bucket.getFiles({ prefix: 'temp/' });

    for (const file of files) {
      if (count >= 100) break;
      try {
        const [metadata] = await file.getMetadata();
        const updatedAt = new Date(metadata.updated as string);
        if (updatedAt < oneDayAgo) {
          await file.delete();
          deletedFiles.push(file.name);
          count++;
        }
      } catch (err) {
        console.warn(`[WARN] Error processing temp file ${file.name}:`, err);
      }
    }

    return { timestamp: new Date(), type: 'temp_files', status: 'success', count, deletedFiles, duration: Date.now() - startTime };
  } catch (error: any) {
    console.error('[ERROR] cleanupTempFiles:', error);
    return { timestamp: new Date(), type: 'temp_files', status: 'failed', count, deletedFiles, error: error.message, duration: Date.now() - startTime };
  }
}

/**
 * Удаляет аватары пользователей старше 1 года, если у пользователя нет аватара.
 * Путь: avatars/{userId}/{timestamp}_{filename}
 */
export async function cleanupOldAvatars(): Promise<StorageCleanupLog> {
  const startTime = Date.now();
  const deletedFiles: string[] = [];
  let count = 0;

  try {
    const bucket = admin.storage().bucket();
    const db = admin.firestore();
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    const [files] = await bucket.getFiles({ prefix: 'avatars/' });

    for (const file of files) {
      if (count >= 50) break;
      try {
        const [metadata] = await file.getMetadata();
        const updatedAt = new Date(metadata.updated as string);
        if (updatedAt >= oneYearAgo) continue;

        const parts = file.name.split('/');
        if (parts.length < 2) continue;
        const userId = parts[1];

        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : null;

        // Удаляем если пользователя нет или у него нет аватара
        if (!userData || !userData['avatar']) {
          await file.delete();
          deletedFiles.push(file.name);
          count++;
        }
      } catch (err) {
        console.warn(`[WARN] Error processing avatar ${file.name}:`, err);
      }
    }

    return { timestamp: new Date(), type: 'old_avatars', status: 'success', count, deletedFiles, duration: Date.now() - startTime };
  } catch (error: any) {
    console.error('[ERROR] cleanupOldAvatars:', error);
    return { timestamp: new Date(), type: 'old_avatars', status: 'failed', count, deletedFiles, error: error.message, duration: Date.now() - startTime };
  }
}

export async function logStorageCleanupResult(log: StorageCleanupLog): Promise<void> {
  try {
    await admin.firestore().collection('cleanup-logs').add(log);
  } catch (error) {
    console.error('[ERROR] Failed to log storage cleanup:', error);
  }
}

export async function runAllStorageCleanups(): Promise<StorageCleanupLog[]> {
  console.log('[INFO] Starting weekly Storage cleanup...');

  const settled = await Promise.allSettled([
    cleanupOrphanedImages(),
    cleanupTempFiles(),
    cleanupOldAvatars(),
  ]);

  const results: StorageCleanupLog[] = [];
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      results.push(result.value);
      await logStorageCleanupResult(result.value);
    } else {
      console.error('[ERROR] Storage cleanup task failed:', result.reason);
    }
  }

  console.log('[INFO] Storage cleanup done:', results.map(r => `${r.type}:${r.count}`).join(', '));
  return results;
}
