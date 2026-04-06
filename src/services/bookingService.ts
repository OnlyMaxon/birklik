import { db } from '../config/firebase'
import { collection, doc, addDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore'
import { Booking } from '../types'

const COLLECTION_NAME = 'bookings'

/**
 * Create a new booking
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
 * Get bookings for a property (for owner)
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
 * Get bookings for a user (bookings they made)
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
 * Cancel a booking
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
 * Check if user has booked this property
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
