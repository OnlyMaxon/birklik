import { db } from '../config/firebase'
import { collection, addDoc, query, where, orderBy, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore'
import { Notification, BookingNotification, CommentNotification, FavoriteNotification, PremiumNotification, ReportNotification, RatingNotification } from '../types'
import * as logger from './logger'

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
 * Create booking notification for property owner
 * @param {string} ownerId - Property owner's user ID
 * @param {BookingNotification} notificationData - Booking notification details
 * @returns {Promise<string|null>} Notification ID or null on error
 */
export const createBookingNotification = async (
  ownerId: string,
  notificationData: Omit<BookingNotification, 'id' | 'createdAt'>
): Promise<string | null> => {
  try {
    const notificationsRef = collection(db, COLLECTION_NAME, ownerId, NOTIFICATIONS_SUBCOLLECTION)
    const docRef = await addDoc(notificationsRef, {
      ...notificationData,
      createdAt: new Date().toISOString()
    })
    return docRef.id
  } catch (error) {
    logger.error('Error creating booking notification:', error)
    return null
  }
}

/**
 * Create comment notification for property owner
 * @param {string} ownerId - Property owner's user ID
 * @param {CommentNotification} notificationData - Comment notification details
 * @returns {Promise<string|null>} Notification ID or null on error
 */
export const createCommentNotification = async (
  ownerId: string,
  notificationData: Omit<CommentNotification, 'id' | 'createdAt'>
): Promise<string | null> => {
  try {
    const notificationsRef = collection(db, COLLECTION_NAME, ownerId, NOTIFICATIONS_SUBCOLLECTION)
    const docRef = await addDoc(notificationsRef, {
      ...notificationData,
      createdAt: new Date().toISOString()
    })
    return docRef.id
  } catch (error) {
    logger.error('Error creating comment notification:', error)
    return null
  }
}

/**
 * Create favorite notification for property owner
 * @param {string} ownerId - Property owner's user ID
 * @param {FavoriteNotification} notificationData - Favorite notification details
 * @returns {Promise<string|null>} Notification ID or null on error
 */
export const createFavoriteNotification = async (
  ownerId: string,
  notificationData: Omit<FavoriteNotification, 'id' | 'createdAt'>
): Promise<string | null> => {
  try {
    const notificationsRef = collection(db, COLLECTION_NAME, ownerId, NOTIFICATIONS_SUBCOLLECTION)
    const docRef = await addDoc(notificationsRef, {
      ...notificationData,
      createdAt: new Date().toISOString()
    })
    return docRef.id
  } catch (error) {
    logger.error('Error creating favorite notification:', error)
    return null
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
 * Create premium notification for property owner
 * @param {string} ownerId - Property owner's user ID
 * @param {PremiumNotification} notificationData - Premium notification details
 * @returns {Promise<string|null>} Notification ID or null on error
 */
export const createPremiumNotification = async (
  ownerId: string,
  notificationData: Omit<PremiumNotification, 'id' | 'createdAt'>
): Promise<string | null> => {
  try {
    const notificationsRef = collection(db, COLLECTION_NAME, ownerId, NOTIFICATIONS_SUBCOLLECTION)
    const docRef = await addDoc(notificationsRef, {
      ...notificationData,
      createdAt: new Date().toISOString()
    })
    return docRef.id
  } catch (error) {
    logger.error('Error creating premium notification:', error)
    return null
  }
}

/**
 * Create comment report notification for all moderators
 * @param {ReportNotification} notificationData - Report notification details
 * @returns {Promise<string[]>} Array of created notification IDs
 */
export const createReportNotification = async (
  notificationData: Omit<ReportNotification, 'id' | 'createdAt' | 'userId' | 'relatedId' | 'relatedUserId' | 'relatedUserName' | 'actionUrl'>
): Promise<string[]> => {
  try {
    // Get all users with moderator role
    const usersRef = collection(db, COLLECTION_NAME)
    const q = query(usersRef, where('isModerator', '==', true))
    const snapshot = await getDocs(q)
    
    if (snapshot.empty) {
      logger.warn('No moderators found for report notification')
      return []
    }

    // Send notification to ALL moderators
    const notificationIds: string[] = []
    for (const moderatorDoc of snapshot.docs) {
      const moderatorId = moderatorDoc.id
      const notificationsRef = collection(db, COLLECTION_NAME, moderatorId, NOTIFICATIONS_SUBCOLLECTION)
      
      try {
        const docRef = await addDoc(notificationsRef, {
          ...notificationData,
          userId: moderatorId,
          read: false,
          createdAt: new Date().toISOString()
        })
        notificationIds.push(docRef.id)
      } catch (error) {
        logger.error(`Error creating notification for moderator ${moderatorId}:`, error)
      }
    }
    
    return notificationIds
  } catch (error) {
    logger.error('Error creating report notification:', error)
    return []
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
