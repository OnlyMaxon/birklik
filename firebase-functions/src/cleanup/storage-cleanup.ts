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
 * Достаёт Storage-путь из legacy download-URL или /api/images URL.
 * https://.../o/properties%2Fuid%2F123_a.jpg?alt=media  →  properties/uid/123_a.jpg
 */
function storagePathFromUrl(url: string): string | null {
  const match = url?.match?.(/\/o\/([^?]+)/) || url?.match?.(/\/api\/images\/([^?"\s]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null; // повреждённый URL — файл лучше оставить в покое
  }
}

/** Максимальная глубина обхода подколлекций. Реальная вложенность — 2. */
const MAX_DEPTH = 5;

/**
 * Собирает Storage-пути, на которые ссылается хоть один документ Firestore.
 *
 * Обход рекурсивный и без списка коллекций: все корневые плюс все подколлекции
 * каждого документа. Документ читается целиком, а не по полю images — так ссылка
 * не потеряется, если появится новое поле с картинкой.
 */
export async function collectReferencedPaths(): Promise<Set<string>> {
  const db = admin.firestore();
  const referenced = new Set<string>();

  const walk = async (col: any, depth: number): Promise<void> => {
    if (depth > MAX_DEPTH) return;
    const snap = await col.get();
    for (const doc of snap.docs) {
      const text = JSON.stringify(doc.data());
      for (const re of [/\/o\/([^"?\s\\]+)/g, /\/api\/images\/([^"?\s\\]+)/g]) {
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
          try {
            referenced.add(decodeURIComponent(m[1]));
          } catch {
            // повреждённый URL — пропускаем, файл останется жив
          }
        }
      }
      for (const sub of await doc.ref.listCollections()) {
        await walk(sub, depth + 1);
      }
    }
  };

  for (const col of await db.listCollections()) {
    await walk(col, 1);
  }
  return referenced;
}

/**
 * Удаляет неиспользуемые изображения объявлений.
 *
 * Путь в Storage: properties/{userId}/{timestamp}_{filename} — propertyId в нём
 * не хранится.
 *
 * Раньше файлы группировались по владельцу папки, а ссылки искались запросом
 * `properties where ownerId == этот_userId`. Это уничтожило 49 живых фотографий
 * 2026-08-09: три объявления держат фото в папке ДРУГОГО пользователя (кто-то
 * загружал их за владельцев), их ownerId в выборку не попадал, и файлы выглядели
 * ничьими. Поэтому набор ссылок теперь собирается глобально по всему Firestore,
 * а не по одному пользователю.
 *
 * Сверка — по декодированному пути и точному равенству. Прежний вариант искал
 * подстроку в URL через encodeURIComponent, и при нестандартном символе в имени
 * кодировки расходились.
 */
export async function cleanupOrphanedImages(): Promise<StorageCleanupLog> {
  const startTime = Date.now();
  const deletedFiles: string[] = [];
  let count = 0;

  try {
    const bucket = admin.storage().bucket();
    // 30 дней вместо 7: запас на случай, если файл ещё не привязан к документу.
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const referencedPaths = await collectReferencedPaths();

    // Предохранитель: ни одной разобранной ссылки на весь проект означало бы,
    // что сиротами стали ВСЕ файлы. Это сбой обхода, а не реальное состояние.
    if (referencedPaths.size === 0) {
      console.error('[ERROR] cleanupOrphanedImages: 0 ссылок во всём Firestore — прерываю, иначе удалятся все файлы');
      return { timestamp: new Date(), type: 'orphaned_images', status: 'failed', count: 0, deletedFiles, error: 'no referenced paths', duration: Date.now() - startTime };
    }

    const [files] = await bucket.getFiles({ prefix: 'properties/' });

    // Сначала собираем кандидатов, и только потом решаем, удалять ли вообще.
    const candidates: typeof files = [];
    for (const file of files) {
      if (file.name.split('/').length < 3) continue; // ждём properties/{userId}/{filename}
      if (referencedPaths.has(file.name)) continue;
      candidates.push(file);
    }

    // Порог здравого смысла.
    //
    // 2026-08-30 эта функция снесла 124 живые фотографии восьми объявлений:
    // работала версия, не знавшая формата ссылок `/api/images/...`, и все такие
    // файлы выглядели ничьими. Формально предохранитель выше сработать не мог —
    // ссылки-то собрались, просто не все.
    //
    // Настоящие сироты появляются по одной-две за неделю. Когда «мусором» вдруг
    // оказывается заметная доля бакета, это почти наверняка означает, что мы
    // перестали понимать какой-то формат ссылки, а не что пользователи разом
    // удалили сотню фотографий. В таком случае честнее не тронуть ничего и
    // прокричать в лог.
    const SANE_SHARE = 0.05;
    if (candidates.length > Math.max(20, files.length * SANE_SHARE)) {
      console.error(
        `[ERROR] cleanupOrphanedImages: кандидатов на удаление ${candidates.length} из ${files.length} файлов ` +
        `(> ${Math.round(SANE_SHARE * 100)}%) — прерываю. Похоже, часть ссылок перестала распознаваться. ` +
        `Проверить collectReferencedPaths и форматы URL в Firestore.`
      );
      console.error('[ERROR] примеры кандидатов:', candidates.slice(0, 10).map(f => f.name));
      return { timestamp: new Date(), type: 'orphaned_images', status: 'failed', count: 0, deletedFiles, error: `too many orphan candidates: ${candidates.length}/${files.length}`, duration: Date.now() - startTime };
    }

    for (const file of candidates) {
      if (count >= 500) break;
      try {
        const [metadata] = await file.getMetadata();
        // Пропускаем свежие файлы (могут ещё не быть привязаны)
        if (new Date(metadata.updated as string) > cutoff) continue;

        await file.delete();
        deletedFiles.push(file.name);
        count++;
      } catch (err) {
        console.warn(`[WARN] Error processing file ${file.name}:`, err);
      }
    }

    console.log(`[Cleanup] orphaned images: ${count} удалено, ссылок в базе ${referencedPaths.size}, файлов ${files.length}`);
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
 * Удаляет устаревшие аватары (старше 30 дней), на которые нигде нет ссылок.
 * Путь: avatars/{userId}/{timestamp}_{filename}.
 *
 * Проверять только users/{userId}.avatar недостаточно: URL аватара копируется
 * в комментарии (поле userAvatar), и удаление «не текущего» файла оставило бы
 * в комментариях битые картинки. Поэтому сверка идёт по тому же глобальному
 * набору ссылок, что и для фотографий объявлений.
 */
export async function cleanupOldAvatars(): Promise<StorageCleanupLog> {
  const startTime = Date.now();
  const deletedFiles: string[] = [];
  let count = 0;

  try {
    const bucket = admin.storage().bucket();
    const db = admin.firestore();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const referencedPaths = await collectReferencedPaths();
    if (referencedPaths.size === 0) {
      console.error('[ERROR] cleanupOldAvatars: 0 ссылок во всём Firestore — прерываю');
      return { timestamp: new Date(), type: 'old_avatars', status: 'failed', count: 0, deletedFiles, error: 'no referenced paths', duration: Date.now() - startTime };
    }

    const [files] = await bucket.getFiles({ prefix: 'avatars/' });

    // Кэш: userId → текущий Storage-путь аватара (чтобы не запрашивать Firestore повторно)
    const currentAvatarPathByUser = new Map<string, string | null>();

    for (const file of files) {
      if (count >= 200) break;
      try {
        // Ссылается хоть кто-то — оставляем, даже если это не текущий аватар
        if (referencedPaths.has(file.name)) continue;

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
          currentAvatarPathByUser.set(
            userId,
            avatarUrl ? storagePathFromUrl(avatarUrl) : null
          );
        }

        // Удаляем если файл не является текущим аватаром
        if (currentAvatarPathByUser.get(userId) !== file.name) {
          await file.delete();
          deletedFiles.push(file.name);
          count++;
        }
      } catch (err) {
        console.warn(`[WARN] Error processing avatar ${file.name}:`, err);
      }
    }

    console.log(`[Cleanup] old avatars: ${count} удалено из ${files.length}`);
    return { timestamp: new Date(), type: 'old_avatars', status: 'success', count, deletedFiles, duration: Date.now() - startTime };
  } catch (error: any) {
    console.error('[ERROR] cleanupOldAvatars:', error);
    return { timestamp: new Date(), type: 'old_avatars', status: 'failed', count, deletedFiles, error: error.message, duration: Date.now() - startTime };
  }
}

/**
 * Отчёты о прогонах живут в Cloud Logging, а не в Firestore. Список удалённых
 * файлов печатается целиком: именно по нему разбирали инцидент 2026-08-09.
 */
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
      console.log(`[Cleanup] ${result.value.type}: ${result.value.status}, удалено ${result.value.count}`, result.value.deletedFiles);
    } else {
      console.error('[ERROR] Storage cleanup task failed:', result.reason);
    }
  }

  console.log('[INFO] Storage cleanup done:', results.map(r => `${r.type}:${r.count}`).join(', '));
  return results;
}
