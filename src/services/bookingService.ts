import { db } from '../config/firebase'
import { collection, doc, addDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore'
import { Booking } from '../types'

const COLLECTION_NAME = 'bookings'

/**
 * Create a new booking record
 * @param {Omit<Booking, 'id' | 'createdAt'>} booking - Booking data (excluding id and creation timestamp)
 * @returns {Promise<Booking | null>} Created booking with id and timestamp, or null on failure
 * @throws {Error} On Firestore write failure
 * @example
 * const booking = await createBooking({
 *   propertyId: 'prop_123',
 *   userId: 'user_456',
 *   startDate: '2024-04-01',
 *   endDate: '2024-04-05',
 *   totalPrice: 250
 * })
 */
export const createBooking = async (booking: Omit<Booking, 'id' | 'createdAt'>): Promise<Booking | null> => {
  try {
    const now = new Date().toISOString()

    const bookingData = {
      ...booking,
      createdAt: now,
      status: 'active' as const
    }

    const docRef = await addDoc(collection(db, COLLECTION_NAME), bookingData)
    return { id: docRef.id, ...bookingData } as Booking
  } catch (error) {
    console.error('Error creating booking:', error)
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
    console.error('Error getting property bookings:', error)
    return []
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
    console.error('Error getting user bookings:', error)
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
export const cancelBooking = async (bookingId: string): Promise<boolean> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, bookingId)
    await deleteDoc(docRef)
    return true
  } catch (error) {
    console.error('Error cancelling booking:', error)
    return false
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
      where('status', '==', 'active')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.length > 0
  } catch (error) {
    console.error('Error checking booking:', error)
    return false
  }
}
