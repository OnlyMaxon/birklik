import { db } from '../lib/firebase/client'
import { collection, addDoc, query, where, orderBy, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore'
import { Notification, BookingApprovedNotification, BookingRejectedNotification, RatingNotification, CancellationRequestNotification, CancellationApprovedNotification, CancellationRejectedNotification, ListingRejectedNotification } from '@birklik/core/types'
import * as logger from './logger'

// Удалены как неиспользуемые (2026-08-31): createNotification и обёртки для
// booking/comment/favorite/premium/report/invoice, а также
// getModerationNotificationsCount. Живые уведомления шлют серверные экшены и
// адресные создатели ниже.

const COLLECTION_NAME = 'users'
const NOTIFICATIONS_SUBCOLLECTION = 'notifications'


/**
 * Get all notifications for a user
 * @param {string} userId - User Firestore ID
 * @returns {Promise<Notification[]>} Array of notifications ordered by date
 */
export const getUserNotifications = async (userId: string): Promise<Notification[]> => {
  try {
    const notificationsRef = collection(db, COLLECTION_NAME, userId, NOTIFICATIONS_SUBCOLLECTION)
    const q = query(notificationsRef, orderBy('createdAt', 'desc'))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Notification[]
  } catch (error) {
    logger.error('Error getting notifications:', error)
    return []
  }
}

/**
 * Get unread notifications count
 * @param {string} userId - User Firestore ID
 * @returns {Promise<number>} Count of unread notifications
 */
export const getUnreadNotificationsCount = async (userId: string): Promise<number> => {
  try {
    const notificationsRef = collection(db, COLLECTION_NAME, userId, NOTIFICATIONS_SUBCOLLECTION)
    const q = query(notificationsRef, where('read', '==', false))
    const snapshot = await getDocs(q)
    return snapshot.size
  } catch (error) {
    logger.error('Error getting unread count:', error)
    return 0
  }
}





/**
 * Mark notification as read
 * @param {string} userId - User Firestore ID
 * @param {string} notificationId - Notification ID
 * @returns {Promise<boolean>} True on success, false on error
 */
export const markNotificationAsRead = async (userId: string, notificationId: string): Promise<boolean> => {
  try {
    const notificationRef = doc(db, COLLECTION_NAME, userId, NOTIFICATIONS_SUBCOLLECTION, notificationId)
    await updateDoc(notificationRef, { read: true })
    return true
  } catch (error) {
    logger.error('Error marking notification as read:', error)
    return false
  }
}

/**
 * Delete notification
 * @param {string} userId - User Firestore ID
 * @param {string} notificationId - Notification ID
 * @returns {Promise<boolean>} True on success, false on error
 */
export const deleteNotification = async (userId: string, notificationId: string): Promise<boolean> => {
  try {
    const notificationRef = doc(db, COLLECTION_NAME, userId, NOTIFICATIONS_SUBCOLLECTION, notificationId)
    await deleteDoc(notificationRef)
    return true
  } catch (error) {
    logger.error('Error deleting notification:', error)
    return false
  }
}



/**
 * Create rating notification for property owner
 * @param {string} ownerId - Property owner's user ID
 * @param {RatingNotification} notificationData - Rating notification details
 * @returns {Promise<string|null>} Notification ID or null on error
 */
export const createRatingNotification = async (
  ownerId: string,
  notificationData: Omit<RatingNotification, 'id' | 'createdAt' | 'userId'>
): Promise<string | null> => {
  try {
    const notificationsRef = collection(db, COLLECTION_NAME, ownerId, NOTIFICATIONS_SUBCOLLECTION)
    const docRef = await addDoc(notificationsRef, {
      userId: ownerId,
      ...notificationData,
      read: false,
      createdAt: new Date().toISOString()
    })
    return docRef.id
  } catch (error) {
    logger.error('Error creating rating notification:', error)
    return null
  }
}

/**
 * Create cancellation request notification for property owner
 * @param {string} ownerId - Property owner's user ID
 * @param {CancellationRequestNotification} notificationData - Cancellation request notification details
 * @returns {Promise<string|null>} Notification ID or null on error
 */
export const createCancellationRequestNotification = async (
  ownerId: string,
  notificationData: Omit<CancellationRequestNotification, 'id' | 'createdAt' | 'userId'>
): Promise<string | null> => {
  try {
    const notificationsRef = collection(db, COLLECTION_NAME, ownerId, NOTIFICATIONS_SUBCOLLECTION)
    const docRef = await addDoc(notificationsRef, {
      userId: ownerId,
      ...notificationData,
      read: false,
      createdAt: new Date().toISOString()
    })
    return docRef.id
  } catch (error) {
    logger.error('Error creating cancellation request notification:', error)
    return null
  }
}

/**
 * Create cancellation approved notification for guest
 * @param {string} guestId - Guest's user ID
 * @param {CancellationApprovedNotification} notificationData - Cancellation approved notification details
 * @returns {Promise<string|null>} Notification ID or null on error
 */
export const createCancellationApprovedNotification = async (
  guestId: string,
  notificationData: Omit<CancellationApprovedNotification, 'id' | 'createdAt' | 'userId'>
): Promise<string | null> => {
  try {
    const notificationsRef = collection(db, COLLECTION_NAME, guestId, NOTIFICATIONS_SUBCOLLECTION)
    const docRef = await addDoc(notificationsRef, {
      userId: guestId,
      ...notificationData,
      read: false,
      createdAt: new Date().toISOString()
    })
    return docRef.id
  } catch (error) {
    logger.error('Error creating cancellation approved notification:', error)
    return null
  }
}

/**
 * Create cancellation rejected notification for guest
 * @param {string} guestId - Guest's user ID
 * @param {CancellationRejectedNotification} notificationData - Cancellation rejected notification details
 * @returns {Promise<string|null>} Notification ID or null on error
 */
export const createCancellationRejectedNotification = async (
  guestId: string,
  notificationData: Omit<CancellationRejectedNotification, 'id' | 'createdAt' | 'userId'>
): Promise<string | null> => {
  try {
    const notificationsRef = collection(db, COLLECTION_NAME, guestId, NOTIFICATIONS_SUBCOLLECTION)
    const docRef = await addDoc(notificationsRef, {
      userId: guestId,
      ...notificationData,
      read: false,
      createdAt: new Date().toISOString()
    })
    return docRef.id
  } catch (error) {
    logger.error('Error creating cancellation rejected notification:', error)
    return null
  }
}

/**
 * Create booking approved notification for guest
 * @param {string} guestId - Guest's user ID
 * @param {BookingApprovedNotification} notificationData - Booking approved notification details
 * @returns {Promise<string|null>} Notification ID or null on error
 */
export const createBookingApprovedNotification = async (
  guestId: string,
  notificationData: Omit<BookingApprovedNotification, 'id' | 'createdAt' | 'userId'>
): Promise<string | null> => {
  try {
    const notificationsRef = collection(db, COLLECTION_NAME, guestId, NOTIFICATIONS_SUBCOLLECTION)
    const docRef = await addDoc(notificationsRef, {
      userId: guestId,
      ...notificationData,
      read: false,
      createdAt: new Date().toISOString()
    })
    return docRef.id
  } catch (error) {
    logger.error('Error creating booking approved notification:', error)
    return null
  }
}

/**
 * Create booking rejected notification for guest
 * @param {string} guestId - Guest's user ID
 * @param {BookingRejectedNotification} notificationData - Booking rejected notification details
 * @returns {Promise<string|null>} Notification ID or null on error
 */
export const createBookingRejectedNotification = async (
  guestId: string,
  notificationData: Omit<BookingRejectedNotification, 'id' | 'createdAt' | 'userId'>
): Promise<string | null> => {
  try {
    const notificationsRef = collection(db, COLLECTION_NAME, guestId, NOTIFICATIONS_SUBCOLLECTION)
    const docRef = await addDoc(notificationsRef, {
      userId: guestId,
      ...notificationData,
      read: false,
      createdAt: new Date().toISOString()
    })
    return docRef.id
  } catch (error) {
    logger.error('Error creating booking rejected notification:', error)
    return null
  }
}

/**
 * Create listing rejected notification for property owner
 * @param {string} ownerId - Property owner's user ID
 * @param {ListingRejectedNotification} notificationData - Listing rejected notification details
 * @returns {Promise<string|null>} Notification ID or null on error
 */
export const createListingRejectedNotification = async (
  ownerId: string,
  notificationData: Omit<ListingRejectedNotification, 'id' | 'createdAt' | 'userId'>
): Promise<string | null> => {
  try {
    const notificationsRef = collection(db, COLLECTION_NAME, ownerId, NOTIFICATIONS_SUBCOLLECTION)
    const docRef = await addDoc(notificationsRef, {
      userId: ownerId,
      ...notificationData,
      read: false,
      createdAt: new Date().toISOString()
    })
    return docRef.id
  } catch (error) {
    logger.error('Error creating listing rejected notification:', error)
    return null
  }
}

