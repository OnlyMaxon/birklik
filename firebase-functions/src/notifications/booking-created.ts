import {admin} from '../firebase-admin';

/**
 * Уведомление о новой заявке на бронь — владельцу объявления и всем модераторам.
 *
 * ## Почему это на сервере
 *
 * Модераторов ищут по полю `users.isModerator`, а правила Firestore разрешают
 * читать чужие профили ТОЛЬКО модератору. То есть обычный гость, бронирующий
 * жильё, список модераторов получить не может в принципе — у него на это нет
 * права, и правильно, что нет. Рассылка с клиента здесь невозможна не по
 * недосмотру, а по устройству доступа.
 *
 * ## Заодно закрыта дыра приложения
 *
 * ⚠️ До 2026-11-12 уведомление владельцу отправлял САЙТ — из `actions.ts`
 * сразу после записи брони. А приложение бронь записывало и больше ничего не
 * делало: `createBooking` в `booking-service.ts` просто клал документ. Значит
 * бронь, сделанная с телефона, не доходила до владельца ВООБЩЕ — ни письмом,
 * ни пушем. Снаружи это не видно: владелец видит заявку, когда сам заходит в
 * кабинет, и думает, что так и задумано.
 *
 * Триггер срабатывает на документ, а документ пишут обе площадки одинаково —
 * поэтому рассылка отсюда лечит и сайт, и приложение разом. Клиентскую отправку
 * на сайте при этом УБРАЛИ: оставь обе — и владелец получал бы по два
 * уведомления на каждую бронь с сайта.
 *
 * ## Как доходит до телефона
 *
 * Пуш отсюда не отправляется. Мы только кладём документ в
 * `users/{uid}/notifications`, а дальше работает уже написанный
 * `onNotificationCreated`: он и шлёт FCM на все устройства человека. Один путь
 * доставки на все поводы — комментарий, оценка, жалоба, теперь и бронь.
 */

/** Сколько символов имени показываем в уведомлении модератору. */
const MAX_TITLE = 40;

interface BookingData {
  propertyId?: string;
  ownerId?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  checkInDate?: string;
  checkOutDate?: string;
  nights?: number;
  totalPrice?: number;
}

/**
 * Название объявления для уведомления модератору.
 *
 * Модератор получает заявки по ЧУЖИМ объявлениям и по одному номеру ничего не
 * поймёт. Владельцу название не нужно — он и так знает, что бронируют у него.
 */
async function propertyTitle(propertyId: string): Promise<string> {
  if (!propertyId) return '';
  const snap = await admin.firestore().collection('properties').doc(propertyId).get();
  if (!snap.exists) return '';

  const title = snap.data()?.title as Record<string, string> | undefined;
  const text = title?.az || title?.en || title?.ru || '';
  return text.length > MAX_TITLE ? `${text.slice(0, MAX_TITLE)}…` : text;
}

export async function notifyBookingCreated(
  bookingId: string,
  booking: BookingData
): Promise<void> {
  const db = admin.firestore();
  const propertyId = booking.propertyId ?? '';
  const guestName = booking.userName || 'User';
  const dates = [booking.checkInDate, booking.checkOutDate].filter(Boolean).join(' — ');

  /** Общая часть обоих уведомлений: по ней экран уведомлений строит карточку. */
  const base = {
    type: 'booking',
    read: false,
    propertyId,
    bookingId,
    bookerName: guestName,
    bookerEmail: booking.userEmail ?? '',
    bookerPhone: booking.userPhone ?? '',
    checkInDate: booking.checkInDate ?? '',
    checkOutDate: booking.checkOutDate ?? '',
    relatedId: propertyId,
    relatedUserId: booking.userId ?? '',
    relatedUserName: guestName,
    createdAt: new Date().toISOString(),
  };

  const writes: Array<Promise<unknown>> = [];

  if (booking.ownerId) {
    writes.push(
      db
        .collection('users')
        .doc(booking.ownerId)
        .collection('notifications')
        .add({
          ...base,
          userId: booking.ownerId,
          title: 'New booking request',
          message: `${guestName} booked your property`,
        })
    );
  }

  // Модераторы — по полю в профиле. Настоящее право живёт в заявке токена, и
  // список по полю может оказаться неполным; из заявки его не достать, и
  // ровно так же ищет адресатов рассылка жалоб на комментарии. Кто попал в
  // модераторы скриптом `set-moderator.js`, тому поле выставлено.
  const moderators = await db.collection('users').where('isModerator', '==', true).get();
  const title = await propertyTitle(propertyId);

  for (const moderator of moderators.docs) {
    // Себе уведомление не шлём: модератор, забронировавший сам или получивший
    // бронь на своё объявление, получил бы два письма об одном событии.
    if (moderator.id === booking.ownerId || moderator.id === booking.userId) continue;

    writes.push(
      moderator.ref.collection('notifications').add({
        ...base,
        userId: moderator.id,
        // Тип тот же, `booking`: экран уведомлений умеет его показывать, и
        // заводить ради модератора отдельный вид значило бы править разбор в
        // двух приложениях сразу. Отличает его текст.
        title: 'New booking on the site',
        message: title
          ? `${guestName} booked “${title}”${dates ? `, ${dates}` : ''}`
          : `${guestName} made a booking${dates ? `, ${dates}` : ''}`,
        // ⚠️ Признак «это копия для модератора». Без него нельзя отличить
        // заявку, которую модератор получил как владелец, от присланной ему
        // для присмотра — а кнопки «принять/отклонить» есть только у первой.
        forModerator: true,
      })
    );
  }

  await Promise.all(writes);
}
