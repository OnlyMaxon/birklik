// functions/src/cleanup/storage-cleanup.ts
import {admin} from '../firebase-admin';

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
 * Достаёт Storage-путь из download-URL.
 * https://.../o/properties%2Fuid%2F123_a.jpg?alt=media  →  properties/uid/123_a.jpg
 */
function storagePathFromUrl(url: string): string | null {
  const match = url?.match?.(/\/o\/([^?]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null; // повреждённый URL — файл лучше оставить в покое
  }
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
 *
 * Сверка идёт по декодированному пути и точному равенству. Прежний вариант
 * искал подстроку в URL через encodeURIComponent — при нестандартном символе
 * в имени кодировки расходились, и живое фото считалось сиротой.
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
      if (count >= 500) break;

      // Получаем все объявления этого пользователя
      const propertiesSnap = await db
        .collection('properties')
        .where('ownerId', '==', userId)
        .get();

      // Собираем Storage-пути всех изображений из всех объявлений пользователя
      const referencedPaths = new Set<string>();
      for (const doc of propertiesSnap.docs) {
        const images: string[] = doc.data().images || [];
        for (const url of images) {
          const p = storagePathFromUrl(url);
          if (p) referencedPaths.add(p);
        }
      }

      // Предохранитель: у пользователя есть объявления, но ни одной разобранной
      // ссылки — значит сломался разбор URL, а не все фото разом осиротели.
      if (propertiesSnap.size > 0 && referencedPaths.size === 0) {
        console.warn(`[WARN] ${userId}: ${propertiesSnap.size} объявлений, 0 распознанных ссылок — пропускаю`);
        continue;
      }

      for (const file of userFiles) {
        if (count >= 500) break;

        try {
          const [metadata] = await file.getMetadata();
          const updatedAt = new Date(metadata.updated as string);

          // Пропускаем свежие файлы (могут ещё не быть привязаны)
          if (updatedAt > sevenDaysAgo) continue;

          // Проверяем: ссылается ли на этот файл хоть одно объявление
          if (!referencedPaths.has(file.name)) {
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
 * Удаляет устаревшие аватары (старше 30 дней), которые больше не являются текущим
 * аватаром пользователя. Путь: avatars/{userId}/{timestamp}_{filename}.
 * Нынешний аватар пользователя хранится в users/{userId}.avatar как полный URL.
 */
export async function cleanupOldAvatars(): Promise<StorageCleanupLog> {
  const startTime = Date.now();
  const deletedFiles: string[] = [];
  let count = 0;

  try {
    const bucket = admin.storage().bucket();
    const db = admin.firestore();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [files] = await bucket.getFiles({ prefix: 'avatars/' });

    // Кэш: userId → текущий Storage-путь аватара (чтобы не запрашивать Firestore повторно)
    const currentAvatarPathByUser = new Map<string, string | null>();

    for (const file of files) {
      if (count >= 200) break;
      try {
        const [metadata] = await file.getMetadata();
        const updatedAt = new Date(metadata.updated as string);
        // Пропускаем свежие файлы — могут ещё не быть привязаны
        if (updatedAt >= thirtyDaysAgo) continue;

        const parts = file.name.split('/');
        if (parts.length < 3) continue;
        const userId = parts[1];

        if (!currentAvatarPathByUser.has(userId)) {
          const userDoc = await db.collection('users').doc(userId).get();
          const avatarUrl: string | undefined = userDoc.exists ? userDoc.data()?.['avatar'] : undefined;
          if (avatarUrl && avatarUrl.includes('firebasestorage')) {
            const match = avatarUrl.match(/\/o\/(.+?)\?/);
            currentAvatarPathByUser.set(userId, match ? decodeURIComponent(match[1]) : null);
          } else {
            currentAvatarPathByUser.set(userId, null);
          }
        }

        const currentPath = currentAvatarPathByUser.get(userId);
        // Удаляем если файл не является текущим аватаром
        if (currentPath !== file.name) {
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
