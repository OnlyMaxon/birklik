import { db } from '../config/firebase'
import { collection, doc, addDoc, query, where, getDocs, getDoc } from 'firebase/firestore'
import { Booking } from '../types'
import { validateCsrfToken } from './csrfService'
import * as logger from './logger'

const COLLECTION_NAME = 'bookings'

// Custom error for booking conflicts
export class BookingConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BookingConflictError'
  }
}

/**
 * Create a new booking record with CSRF protection
 * @param {Omit<Booking, 'id' | 'createdAt'>} booking - Booking data (excluding id and creation timestamp)
 * @param {string} csrfToken - CSRF token for validation
 * @returns {Promise<Booking | null>} Created booking with id and timestamp, or null on failure
 * @throws {Error} On Firestore write failure, CSRF validation failure, or if booking conflicts with existing booking
 * @example
 * const booking = await createBooking({
 *   propertyId: 'prop_123',
 *   userId: 'user_456',
 *   checkInDate: '2024-04-01',
 *   checkOutDate: '2024-04-05',
 *   totalPrice: 250,
 *   userName: 'John',
 *   userEmail: 'john@example.com',
 *   userPhone: '+1234567890',
 *   nights: 4
 * }, csrfToken)
 */
export const createBooking = async (booking: Omit<Booking, 'id' | 'createdAt'>, csrfToken: string): Promise<Booking | null> => {
  try {
    
    // Validate CSRF token
    if (!validateCsrfToken(csrfToken)) {
      logger.error('CSRF token validation failed')
      return null
    }

    // Check for date conflicts before creating booking
    const hasConflict = await checkBookingConflict(booking.propertyId, booking.checkInDate, booking.checkOutDate)
    if (hasConflict) {
      logger.error('Booking conflict: dates are already booked for this property')
      throw new BookingConflictError('These dates are already booked for this property')
    }

    const now = new Date().toISOString()

    const bookingData = {
      ...booking,
      createdAt: now,
      status: 'pending' as const
    }

    const docRef = await addDoc(collection(db, COLLECTION_NAME), bookingData)
    const result = { id: docRef.id, ...bookingData } as Booking
    return result
  } catch (error) {
    logger.error('Error creating booking:', error)
    return null
  }
}

/**
 * Retrieve all bookings for a property (for property owner)
 * @param {string} propertyId - Property Firestore document ID
 * @returns {Promise<Booking[]>} Array of bookings for the property
 * @throws {Error} On Firestore query failure
 * @example
 * const bookings = await getPropertyBookings('prop_789')
 */
export const getPropertyBookings = async (propertyId: string): Promise<Booking[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('propertyId', '==', propertyId)
    )
    const snapshot = await getDocs(q)

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Omit<Booking, 'id'>)
    }))
  } catch (error) {
    logger.error('Error getting property bookings:', error)
    return []
  }
}

/**
 * Check if a booking conflicts with existing bookings for the same property
 * @param {string} propertyId - Property Firestore document ID
 * @param {string} checkInDate - Proposed check-in date (ISO string)
 * @param {string} checkOutDate - Proposed check-out date (ISO string)
 * @returns {Promise<boolean>} True if there's a date conflict, false otherwise
 * @throws {Error} On Firestore query failure
 * @example
 * const hasConflict = await checkBookingConflict('prop_123', '2024-04-01', '2024-04-05')
 */
export const checkBookingConflict = async (propertyId: string, checkInDate: string, checkOutDate: string): Promise<boolean> => {
  try {
    // Check both approved and pending bookings for conflicts
    const qApproved = query(
      collection(db, COLLECTION_NAME),
      where('propertyId', '==', propertyId),
      where('status', '==', 'approved')
    )
    const qPending = query(
      collection(db, COLLECTION_NAME),
      where('propertyId', '==', propertyId),
      where('status', '==', 'pending')
    )
    
    const snapshotApproved = await getDocs(qApproved)
    const snapshotPending = await getDocs(qPending)
    
    const allSnapshots = [...snapshotApproved.docs, ...snapshotPending.docs]

    const proposedCheckIn = new Date(checkInDate).getTime()
    const proposedCheckOut = new Date(checkOutDate).getTime()

    for (const doc of allSnapshots) {
      const booking = doc.data() as Omit<Booking, 'id'>
      const existingCheckIn = new Date(booking.checkInDate).getTime()
      const existingCheckOut = new Date(booking.checkOutDate).getTime()

      // Check for overlap: proposed range overlaps if it starts before existing ends AND ends after existing starts
      if (proposedCheckIn < existingCheckOut && proposedCheckOut > existingCheckIn) {
        return true
      }
    }

    return false
  } catch (error) {
    logger.error('Error checking booking conflict:', error)
    return false
  }
}

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
    
    // Create cancellation request instead of deleting directly
    const { createCancellationRequest } = await import('./cancellationService')
    const { createCancellationRequestNotification } = await import('./notificationsService')
    
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

    // Notify property owner about cancellation request
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

/**
 * Check if a user has an active booking for a specific property
 * @param {string} userId - User Firestore ID
 * @param {string} propertyId - Property Firestore document ID
 * @returns {Promise<boolean>} True if user has active booking, false otherwise
 * @throws {Error} On Firestore query failure
 * @example
 * const hasBooked = await hasUserBookedProperty('user_789', 'prop_999')
 */
export const hasUserBookedProperty = async (userId: string, propertyId: string): Promise<boolean> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId),
      where('propertyId', '==', propertyId),
      where('status', '==', 'approved')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.length > 0
  } catch (error) {
    logger.error('Error checking booking:', error)
    return false
  }
}

/**
 * Accept a pending booking request
 * @param {string} bookingId - Booking Firestore document ID
 * @returns {Promise<Booking | null>} Updated booking with approved status, or null on failure
 */
export const acceptBooking = async (bookingId: string): Promise<Booking | null> => {
  try {
    const { updateDoc } = await import('firebase/firestore')
    const docRef = doc(db, COLLECTION_NAME, bookingId)
    const bookingSnap = await getDoc(docRef)
    
    if (!bookingSnap.exists()) {
      logger.error('Booking not found')
      return null
    }

    const now = new Date().toISOString()
    
    await updateDoc(docRef, {
      status: 'approved',
      approvedAt: now
    })

    const updated = await getDoc(docRef)
    return { id: updated.id, ...(updated.data() as Omit<Booking, 'id'>) }
  } catch (error) {
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
    const { updateDoc } = await import('firebase/firestore')
    const docRef = doc(db, COLLECTION_NAME, bookingId)
    const bookingSnap = await getDoc(docRef)
    
    if (!bookingSnap.exists()) {
      logger.error('Booking not found')
      return null
    }

    const now = new Date().toISOString()
    
    await updateDoc(docRef, {
      status: 'rejected',
      rejectedAt: now,
      rejectionReason: reason || 'No reason provided'
    })

    const updated = await getDoc(docRef)
    return { id: updated.id, ...(updated.data() as Omit<Booking, 'id'>) }
  } catch (error) {
    logger.error('Error rejecting booking:', error)
    return null
  }
}
