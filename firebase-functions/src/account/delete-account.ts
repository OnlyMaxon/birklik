import * as functions from 'firebase-functions/v1';
import {admin} from '../firebase-admin';

/**
 * Удаление аккаунта вместе со всеми данными человека.
 *
 * Google требует этого от всех приложений с регистрацией: кнопка внутри
 * приложения и отдельная общедоступная веб-страница, адрес которой идёт в
 * анкету «Безопасность данных». Наша политика конфиденциальности это уже
 * обещает — «требовать удаление информации», «деактивировать свой аккаунт».
 *
 * ⚠️ Почему это серверная функция, а не код клиента. Клиенту правила не дают
 * сделать почти ничего из нужного:
 *
 * - чужие брони на его объявлениях — `bookings` разрешает писать только
 *   участникам брони, а гость тут посторонний;
 * - снимки, загруженные с другого устройства — правила Storage держат
 *   `request.auth.uid == userId` прямо в пути, а папка заводится по
 *   ЗАГРУЗИВШЕМУ, и у объявления бывают снимки из разных сеансов;
 * - комментарии и оценки, оставленные на ЧУЖИХ объявлениях — их документ
 *   принадлежит другому человеку;
 * - сам вход в Firebase Auth — `deleteUser` есть только у Admin SDK.
 *
 * Функция работает под сервис-аккаунтом и правила обходит целиком, поэтому
 * единственная защита здесь — `context.auth.uid`. **Удаляется всегда тот, кто
 * вызвал, и никогда тот, кого назвали в параметрах.** Идентификатор снаружи не
 * принимается вовсе, чтобы его нечем было подменить.
 *
 * Порядок шагов выбран так, чтобы обрыв на середине не оставил ничего опаснее
 * лишних данных: сам вход удаляется ПОСЛЕДНИМ. Упади функция раньше — человек
 * ещё может войти и нажать кнопку снова. Удали мы вход первым, всё остальное
 * осталось бы навсегда без хозяина и без способа повторить.
 */
export const deleteAccount = functions
  .region('europe-west1')
  .runWith({timeoutSeconds: 540, memory: '512MB'})
  .https.onCall(async (_data: unknown, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    const uid = context.auth.uid;
    const db = admin.firestore();
    const bucket = admin.storage().bucket();
    const now = new Date().toISOString();

    // Считаем сделанное: вызывающему — показать человеку, что именно ушло,
    // журналу — чем кончилось.
    const removed = {
      properties: 0,
      bookings: 0,
      cancellationRequests: 0,
      commentReports: 0,
      comments: 0,
      ratings: 0,
      notifications: 0,
      files: 0,
      paymentsAnonymized: 0,
    };

    /** Уведомление другой стороне — с него же уходит пуш (`onNotificationCreated`). */
    const notify = async (userId: string, bookingId: string, checkInDate: string) => {
      if (!userId || userId === uid) return;
      const when = checkInDate ? ` (${checkInDate})` : '';
      try {
        await db.collection('users').doc(userId).collection('notifications').add({
          userId,
          type: 'cancellationApproved',
          title: 'Bronlaşdırma ləğv edildi / Бронирование отменено',
          message:
            `İstifadəçi hesabını sildi, bronlaşdırma${when} ləğv olundu. / ` +
            `Пользователь удалил аккаунт, бронирование${when} отменено.`,
          read: false,
          createdAt: now,
          relatedId: bookingId,
        });
      } catch (error) {
        // Уведомление — вежливость, а не часть удаления. Молчание почты не
        // повод оставить человеку его данные.
        console.error('[deleteAccount] notify failed', userId, error);
      }
    };

    /** Бронь вместе с запросами на её отмену. */
    const dropBooking = async (snapshot: FirebaseFirestore.QueryDocumentSnapshot) => {
      const booking = snapshot.data() as {
        status?: string;
        userId?: string;
        ownerId?: string;
        checkInDate?: string;
      };

      const requests = await db
        .collection('cancellationRequests')
        .where('bookingId', '==', snapshot.id)
        .get();
      for (const request of requests.docs) {
        await request.ref.delete();
        removed.cancellationRequests += 1;
      }

      // Предупреждаем только по подтверждённым броням: человек рассчитывал на
      // эти даты. Отклонённая или отменённая никого ни к чему не обязывала.
      //
      // ⚠️ Статусов тут ДВА, а не один. В боевой базе у 8 броней из 46 стоит
      // `active` — значения, которого нет в union `Booking['status']`; оно
      // осталось от прежней схемы. Проверяй мы только `approved`, эти гости
      // остались бы без предупреждения об отмене.
      if (booking.status === 'approved' || booking.status === 'active') {
        const other = booking.userId === uid ? booking.ownerId : booking.userId;
        await notify(other || '', snapshot.id, booking.checkInDate || '');
      }

      await snapshot.ref.delete();
      removed.bookings += 1;
    };

    // ---- 1. Объявления человека: снимки, брони на них, сам документ --------
    const properties = await db.collection('properties').where('ownerId', '==', uid).get();
    for (const property of properties.docs) {
      const images = (property.data()?.images as unknown[]) || [];
      for (const image of images) {
        const path = storagePathFromImageSource(String(image));
        if (!path) continue;
        try {
          await bucket.file(path).delete();
          removed.files += 1;
        } catch {
          // Файла уже нет — шаг считается выполненным.
        }
      }

      const bookings = await db
        .collection('bookings')
        .where('propertyId', '==', property.id)
        .get();
      for (const booking of bookings.docs) await dropBooking(booking);

      await property.ref.delete();
      removed.properties += 1;
    }

    // ---- 2. Его брони как гостя -------------------------------------------
    const guestBookings = await db.collection('bookings').where('userId', '==', uid).get();
    for (const booking of guestBookings.docs) await dropBooking(booking);

    // ---- 3. Запросы на отмену, оставшиеся без брони -----------------------
    for (const field of ['guestId', 'ownerId'] as const) {
      const requests = await db.collection('cancellationRequests').where(field, '==', uid).get();
      for (const request of requests.docs) {
        await request.ref.delete();
        removed.cancellationRequests += 1;
      }
    }

    // ---- 4. Его следы на ЧУЖИХ объявлениях --------------------------------
    // Обходом всей коллекции, а не запросом: комментарии лежат массивом внутри
    // объявления, оценки — картой, лайки и избранное — списками. По содержимому
    // массива Firestore искать не умеет, а объявлений на площадке меньше сотни.
    const all = await db.collection('properties').get();
    for (const property of all.docs) {
      const data = property.data() as {
        comments?: {userId?: string; replies?: {userId?: string}[]}[];
        ratings?: Record<string, number>;
        likes?: string[];
        favorites?: string[];
      };

      const patch: Record<string, unknown> = {};

      const comments = data.comments;
      if (Array.isArray(comments)) {
        // Вместе с ответами внутри чужих веток: ответ — это тоже его текст.
        const kept = comments
          .filter(comment => comment?.userId !== uid)
          .map(comment =>
            Array.isArray(comment?.replies)
              ? {...comment, replies: comment.replies.filter(reply => reply?.userId !== uid)}
              : comment
          );
        const before =
          comments.length + comments.reduce((n, c) => n + (c?.replies?.length || 0), 0);
        const after = kept.length + kept.reduce((n, c) => n + (c?.replies?.length || 0), 0);
        if (after !== before) {
          patch.comments = kept;
          removed.comments += before - after;
        }
      }

      if (data.ratings && uid in data.ratings) {
        const ratings = {...data.ratings};
        delete ratings[uid];
        patch.ratings = ratings;
        // Средняя и счётчик пересчитываются: иначе объявление осталось бы с
        // оценкой от человека, которого больше нет.
        const values = Object.values(ratings);
        patch.reviews = values.length;
        patch.rating = values.length
          ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
          : 0;
        removed.ratings += 1;
      }

      if (Array.isArray(data.likes) && data.likes.includes(uid)) {
        patch.likes = data.likes.filter(id => id !== uid);
      }
      if (Array.isArray(data.favorites) && data.favorites.includes(uid)) {
        patch.favorites = data.favorites.filter(id => id !== uid);
      }

      if (Object.keys(patch).length > 0) {
        patch.updatedAt = now;
        await property.ref.update(patch);
      }
    }

    // ---- 5. Его жалобы на комментарии -------------------------------------
    const reports = await db.collection('commentReports').where('reportedBy', '==', uid).get();
    for (const report of reports.docs) {
      await report.ref.delete();
      removed.commentReports += 1;
    }

    // ---- 6. Платежи: обезличиваем, а не удаляем ---------------------------
    // ⚠️ Единственное исключение из «снести всё», и сознательное. Это журнал
    // выручки: по нему сходятся суммы с банком и с Google Play, и дыра в нём
    // всплывёт при первом же споре о платеже. Личных данных там ровно одно
    // поле — `userId`; стираем связь с человеком, оставляя саму запись.
    const payments = await db.collection('payments').where('userId', '==', uid).get();
    for (const payment of payments.docs) {
      await payment.ref.update({userId: 'deleted', anonymizedAt: now});
      removed.paymentsAnonymized += 1;
    }

    // ---- 7. Уведомления и профиль -----------------------------------------
    const notifications = await db.collection('users').doc(uid).collection('notifications').get();
    for (const notification of notifications.docs) {
      await notification.ref.delete();
      removed.notifications += 1;
    }

    // ---- 8. Его папки в хранилище -----------------------------------------
    // Аватар и всё, что осталось от прошлых загрузок: снимки когда-то удалённых
    // объявлений, оборванные подачи. Папки заводятся по загрузившему, поэтому
    // префикс адресует ровно его файлы и ничьи больше.
    for (const prefix of [`properties/${uid}/`, `avatars/${uid}/`, `temp/${uid}/`]) {
      try {
        const [files] = await bucket.getFiles({prefix});
        for (const file of files) {
          await file.delete();
          removed.files += 1;
        }
      } catch (error) {
        console.error('[deleteAccount] storage prefix failed', prefix, error);
      }
    }

    await db.collection('users').doc(uid).delete();

    // ---- 9. Сам вход — последним ------------------------------------------
    // После этого человек не сможет ни войти, ни повторить вызов, поэтому шаг и
    // стоит в конце: до него всё поправимо повторным нажатием.
    await admin.auth().deleteUser(uid);

    console.log('[deleteAccount] удалён аккаунт', uid, removed);
    return {ok: true, removed};
  });

/**
 * Адрес снимка → путь внутри хранилища.
 *
 * ⚠️ Дословный порт `storagePathFromImageSource` из `@birklik/core/utils/images`.
 * Скопировано намеренно: функции собираются отдельным пакетом и подмодуль `core`
 * в свою сборку не тянут — импорт оттуда не соберётся, а тянуть его туда значит
 * раздуть архив деплоя. **Поменяется формат адресов — править обе стороны.**
 *
 * В боевой базе адреса четырёх видов, они копились годами: путь сайта через
 * прокси `/api/images/...`, `gs://`, прямая ссылка на `firebasestorage` с
 * токеном (так пишет приложение) и старая на `storage.googleapis.com`.
 *
 * Проверка префикса обязательна и здесь: путь приходит из документа, а удаляем
 * мы под сервис-аккаунтом, которому в хранилище можно всё. Без неё запись с
 * подделанным адресом снесла бы любой файл бакета.
 */
const ALLOWED_STORAGE_PREFIXES = ['properties/', 'avatars/'] as const;

function isAllowedStoragePath(path: string): boolean {
  const segments = path.split('/');
  return (
    ALLOWED_STORAGE_PREFIXES.some(prefix => path.startsWith(prefix)) &&
    segments.every(
      segment =>
        segment !== '' && segment !== '.' && segment !== '..' && !segment.includes('\0')
    )
  );
}

function decodePath(path: string): string | null {
  try {
    return path
      .split('/')
      .map(segment => decodeURIComponent(segment))
      .join('/');
  } catch {
    return null;
  }
}

function storagePathFromImageSource(source: string): string | null {
  if (!source) return null;

  const IMAGE_API_PREFIX = '/api/images/';
  if (source.startsWith(IMAGE_API_PREFIX)) {
    const encoded = source.slice(IMAGE_API_PREFIX.length).split(/[?#]/, 1)[0];
    const path = decodePath(encoded);
    return path && isAllowedStoragePath(path) ? path : null;
  }

  if (source.startsWith('gs://')) {
    const firstSlash = source.indexOf('/', 'gs://'.length);
    const path = firstSlash === -1 ? '' : source.slice(firstSlash + 1);
    return isAllowedStoragePath(path) ? path : null;
  }

  try {
    const url = new URL(source);

    if (url.hostname === 'firebasestorage.googleapis.com') {
      const marker = '/o/';
      const at = url.pathname.indexOf(marker);
      if (at === -1) return null;
      const path = decodeURIComponent(url.pathname.slice(at + marker.length));
      return isAllowedStoragePath(path) ? path : null;
    }

    if (url.hostname === 'storage.googleapis.com') {
      const parts = url.pathname.split('/').filter(Boolean);
      const path = decodePath(parts.slice(1).join('/'));
      return path && isAllowedStoragePath(path) ? path : null;
    }
  } catch {
    // Не адрес, а готовый путь внутри хранилища — такие в базе тоже есть.
    return isAllowedStoragePath(source) ? source : null;
  }

  return null;
}
