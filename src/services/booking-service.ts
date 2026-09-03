import { db } from '../lib/firebase/client'
import { collection, doc, query, where, getDocs, getDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { Booking } from '@birklik/core/types'
import * as logger from './logger'

const COLLECTION_NAME = 'bookings'

// Custom error for booking conflicts
export class BookingConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BookingConflictError'
  }
}

// createBooking удалена (2026-08-31): бронь создаёт серверный экшен
// createBookingAction. Здесь же жила известная гонка — getDocs внутри
// runTransaction, то есть чтения вне снапшота транзакции.

// getPropertyBookings удалена: страница объявления берёт брони через
// getPropertyBookingsForAvailability на сервере.

// checkBookingConflict удалена: пересечение дат проверяет сервер при создании
// брони и editBooking при правке.

/**
 * Retrieve all bookings made by a specific user
 * @param {string} userId - User Firestore ID
 * @returns {Promise<Booking[]>} Array of bookings created by the user
 * @throws {Error} On Firestore query failure
 * @example
 * const myBookings = await getUserBookings('user_123')
 */
export const getUserBookings = async (userId: string): Promise<Booking[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId)
    )
    const snapshot = await getDocs(q)

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Omit<Booking, 'id'>)
    }))
  } catch (error) {
    logger.error('Error getting user bookings:', error)
    return []
  }
}

/**
 * Retrieve every booking in the system for the moderation view
 * Sorting happens in memory: an orderBy('createdAt') would silently drop
 * documents that lack the field.
 * @returns {Promise<Booking[]>} All bookings, newest first
 * @example
 * const bookings = await getAllBookings()
 */
export const getAllBookings = async (): Promise<Booking[]> => {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME))

    return snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<Booking, 'id'>)
      }))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  } catch (error) {
    logger.error('Error getting all bookings:', error)
    return []
  }
}

/**
 * Cancel and delete a booking
 * @param {string} bookingId - Booking Firestore document ID
 * @returns {Promise<boolean>} True on success, false on failure
 * @throws {Error} On Firestore delete failure
 * @example
 * const cancelled = await cancelBooking('booking_555')
 */
export const cancelBooking = async (bookingId: string): Promise<{success: boolean; requestId?: string}> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, bookingId)
    const booking = await getDoc(docRef)

    if (!booking.exists()) {
      return { success: false }
    }

    const bookingData = booking.data() as Booking

    if (bookingData.status === 'pending') {
      await updateDoc(docRef, { status: 'cancelled' })
      return { success: true }
    }

    // Approved bookings: create a cancellation request for the owner to review
    const { createCancellationRequest } = await import('./cancellation-service')
    const { createCancellationRequestNotification } = await import('./notifications-service')

    const requestId = await createCancellationRequest(
      bookingId,
      bookingData.propertyId,
      bookingData.ownerId,
      bookingData.userId,
      bookingData.userName,
      bookingData.userEmail,
      bookingData.checkInDate,
      bookingData.checkOutDate
    )

    if (!requestId) {
      return { success: false }
    }

    // Статус брони помечается сразу. Раньше запрос создавался, а сама бронь
    // оставалась 'approved': гость видел «Запрос отправлен» только до
    // перезагрузки, после неё бронь снова выглядела обычной подтверждённой, и
    // владелец в своём списке ничего особенного не замечал.
    await updateDoc(docRef, { status: 'cancellation_requested' })

    await createCancellationRequestNotification(bookingData.ownerId, {
      type: 'cancellationRequest',
      title: '❌ Cancellation Request',
      message: `${bookingData.userName} requested to cancel their booking`,
      bookingId,
      propertyId: bookingData.propertyId,
      requesterName: bookingData.userName,
      requesterEmail: bookingData.userEmail,
      checkInDate: bookingData.checkInDate,
      checkOutDate: bookingData.checkOutDate,
      relatedId: bookingId,
      relatedUserName: bookingData.userName,
      actionUrl: `/dashboard?tab=cancellationRequests`,
      read: false
    })

    return { success: true, requestId }
  } catch (error) {
    logger.error('Error cancelling booking:', error)
    return { success: false }
  }
}

// hasUserBookedProperty удалена: одноимённая проверка живёт в
// property/[id]/queries.ts и работает на сервере.

/**
 * Accept a pending booking request
 * @param {string} bookingId - Booking Firestore document ID
 * @returns {Promise<Booking | null>} Updated booking with approved status, or null on failure
 */
export const acceptBooking = async (bookingId: string): Promise<Booking | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, bookingId)
    const bookingSnap = await getDoc(docRef)

    if (!bookingSnap.exists()) {
      logger.error('Booking not found')
      return null
    }

    const now = new Date().toISOString()
    const existing = bookingSnap.data() as Omit<Booking, 'id'>

    // Пересечение с уже подтверждённой бронью. Проверки здесь не было вовсе, а
    // при этом потоке несколько заявок на одну неделю — обычное дело: бронь ни к
    // чему не обязывает, и интерес проявляют сразу несколько человек. Владелец
    // мог подтвердить двоих подряд, и оба гостя считали дом своим.
    //
    // Сравниваются только подтверждённые: ожидающие заявки друг другу не мешают,
    // в том и смысл — владелец выбирает из них одну.
    const approved = await getDocs(
      query(
        collection(db, COLLECTION_NAME),
        where('propertyId', '==', existing.propertyId),
        where('status', '==', 'approved')
      )
    )

    const clashes = approved.docs.some(other => {
      if (other.id === bookingId) return false
      const rival = other.data() as Omit<Booking, 'id'>
      return existing.checkInDate < rival.checkOutDate && existing.checkOutDate > rival.checkInDate
    })

    if (clashes) {
      throw new BookingConflictError('These dates are already approved for another guest')
    }

    await updateDoc(docRef, { status: 'approved', approvedAt: now })

    return { id: bookingSnap.id, ...existing, status: 'approved', approvedAt: now }
  } catch (error) {
    // Пересечение — осмысленный отказ, а не сбой: пробрасываем, чтобы владелец
    // увидел причину и не гадал.
    if (error instanceof BookingConflictError) throw error
    logger.error('Error accepting booking:', error)
    return null
  }
}

/**
 * Reject a pending booking request
 * @param {string} bookingId - Booking Firestore document ID
 * @param {string} reason - Optional rejection reason
 * @returns {Promise<Booking | null>} Updated booking with rejected status, or null on failure
 */
export const rejectBooking = async (bookingId: string, reason?: string): Promise<Booking | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, bookingId)
    const bookingSnap = await getDoc(docRef)

    if (!bookingSnap.exists()) {
      logger.error('Booking not found')
      return null
    }

    const now = new Date().toISOString()
    const existing = bookingSnap.data() as Omit<Booking, 'id'>
    const rejectionReason = reason || 'No reason provided'

    await updateDoc(docRef, { status: 'rejected', rejectedAt: now, rejectionReason })

    return { id: bookingSnap.id, ...existing, status: 'rejected', rejectedAt: now, rejectionReason }
  } catch (error) {
    logger.error('Error rejecting booking:', error)
    return null
  }
}

/**
 * Edit booking dates for approved bookings (owner/user editing)
 * @param {string} bookingId - Booking Firestore document ID
 * @param {Object} updates - Fields to update (checkInDate, checkOutDate, etc)
 * @returns {Promise<Booking | null>} Updated booking, or null on failure
 */
export const editBooking = async (
  bookingId: string,
  updates: Partial<Booking>
): Promise<Booking | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, bookingId)
    const bookingSnap = await getDoc(docRef)

    if (!bookingSnap.exists()) {
      logger.error('Booking not found')
      return null
    }

    const allowedFields = ['checkInDate', 'checkOutDate', 'nights', 'totalPrice']
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key]) => allowedFields.includes(key))
    )

    if (Object.keys(filteredUpdates).length === 0) {
      logger.error('No valid fields to update')
      return null
    }

    const existing = bookingSnap.data() as Omit<Booking, 'id'>

    // Проверка пересечения с другими бронями объекта. Её не было вовсе: владелец
    // мог передвинуть подтверждённую бронь ровно на те даты, которые уже заняты
    // другой бронью, и обе оставались в силе.
    const checkInDate = (filteredUpdates.checkInDate as string | undefined) ?? existing.checkInDate
    const checkOutDate = (filteredUpdates.checkOutDate as string | undefined) ?? existing.checkOutDate

    if (checkOutDate <= checkInDate) {
      logger.error('Booking checkout must be after checkin')
      return null
    }

    const siblings = await getDocs(
      query(
        collection(db, COLLECTION_NAME),
        where('propertyId', '==', existing.propertyId),
        where('status', 'in', ['approved', 'pending'])
      )
    )

    // Даты хранятся как 'YYYY-MM-DD', поэтому сравниваются строками напрямую.
    const clashes = siblings.docs.some(sibling => {
      if (sibling.id === bookingId) return false
      const other = sibling.data() as Omit<Booking, 'id'>
      return checkInDate < other.checkOutDate && checkOutDate > other.checkInDate
    })

    if (clashes) {
      throw new BookingConflictError('These dates overlap another booking for this property')
    }

    await updateDoc(docRef, filteredUpdates)

    return { id: bookingSnap.id, ...existing, ...filteredUpdates }
  } catch (error) {
    // Конфликт дат — не сбой, а осмысленный отказ: пробрасываем, чтобы интерфейс
    // объяснил причину, а не показал общее «не удалось».
    if (error instanceof BookingConflictError) throw error
    logger.error('Error editing booking:', error)
    return null
  }
}

/**
 * Ответ владельца на запрос отмены подтверждённой брони.
 *
 * До этого отвечать было нечем: запрос создавался, уведомление уходило, а
 * интерфейса не существовало — в боевой базе так накопилось 52 висящих запроса.
 *
 * @param approve true — бронь отменяется, false — остаётся в силе
 * @returns обновлённая бронь; уведомление гостю шлёт вызывающий код, у него есть язык
 */
export const resolveCancellationRequest = async (
  bookingId: string,
  approve: boolean
): Promise<Booking | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, bookingId)
    const snapshot = await getDoc(docRef)
    if (!snapshot.exists()) return null

    const existing = snapshot.data() as Omit<Booking, 'id'>
    if (existing.status !== 'cancellation_requested') {
      logger.warn(`Booking ${bookingId} is not awaiting cancellation`)
      return null
    }

    const status = approve ? ('cancelled' as const) : ('approved' as const)
    await updateDoc(docRef, { status })

    // Документ запроса закрываем следом. Если его нет — бронь всё равно уже
    // переведена, и оставлять её в подвешенном состоянии хуже.
    const { getCancellationRequestByBooking, approveCancellationRequest, rejectCancellationRequest } =
      await import('./cancellation-service')
    const request = await getCancellationRequestByBooking(bookingId)
    if (request) {
      if (approve) await approveCancellationRequest(request.id)
      else await rejectCancellationRequest(request.id)
    }

    return { id: bookingId, ...existing, status }
  } catch (error) {
    logger.error('Error resolving cancellation request:', error)
    return null
  }
}

/**
 * Delete a booking (owner/moderator only)
 * @param {string} bookingId - Booking Firestore document ID
 * @returns {Promise<boolean>} Success status
 */
export const deleteBooking = async (bookingId: string): Promise<boolean> => {
  try {
    // Запросы на отмену этой брони уходят вместе с ней. Раньше бронь удаляли, а
    // запрос оставался: он ссылался в пустоту, нигде не показывался и просто
    // лежал в базе. Так накопилось 52 документа.
    const requests = await getDocs(
      query(collection(db, 'cancellationRequests'), where('bookingId', '==', bookingId))
    )
    for (const request of requests.docs) {
      await deleteDoc(request.ref)
    }

    await deleteDoc(doc(db, COLLECTION_NAME, bookingId))
    return true
  } catch (error) {
    logger.error('Error deleting booking:', error)
    return false
  }
}
