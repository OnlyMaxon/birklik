import { db } from '../config/firebase'
import { collection, addDoc, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore'
import * as logger from './logger'

const COLLECTION_NAME = 'cancellationRequests'

export interface CancellationRequest {
  id: string
  bookingId: string
  propertyId: string
  ownerId: string
  guestId: string
  guestName: string
  guestEmail: string
  checkInDate: string
  checkOutDate: string
  reason?: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  respondedAt?: string
}

/**
 * Create cancellation request
 * @param bookingId - Booking to cancel
 * @param propertyId - Property ID
 * @param ownerId - Property owner ID
 * @param guestId - Guest ID
 * @param guestName - Guest name
 * @param guestEmail - Guest email
 * @param checkInDate - Check-in date
 * @param checkOutDate - Check-out date
 * @param reason - Cancellation reason
 * @returns Cancellation request ID or null on error
 */
export const createCancellationRequest = async (
  bookingId: string,
  propertyId: string,
  ownerId: string,
  guestId: string,
  guestName: string,
  guestEmail: string,
  checkInDate: string,
  checkOutDate: string,
  reason?: string
): Promise<string | null> => {
  try {
    const requestData: any = {
      bookingId,
      propertyId,
      ownerId,
      guestId,
      guestName,
      guestEmail,
      checkInDate,
      checkOutDate,
      status: 'pending',
      createdAt: new Date().toISOString()
    }

    if (reason) {
      requestData.reason = reason
    }

    const docRef = await addDoc(collection(db, COLLECTION_NAME), requestData)
    return docRef.id
  } catch (error) {
    logger.error('Error creating cancellation request:', error)
    return null
  }
}

/**
 * Get pending cancellation requests for property owner
 * @param ownerId - Property owner ID
 * @returns Array of cancellation requests
 */
export const getOwnerCancellationRequests = async (ownerId: string): Promise<CancellationRequest[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('ownerId', '==', ownerId),
      where('status', '==', 'pending')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as CancellationRequest[]
  } catch (error) {
    logger.error('Error getting owner cancellation requests:', error)
    return []
  }
}

/**
 * Approve cancellation request
 * @param requestId - Cancellation request ID
 * @returns Success status
 */
export const approveCancellationRequest = async (requestId: string): Promise<boolean> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, requestId)
    await updateDoc(docRef, {
      status: 'approved',
      respondedAt: new Date().toISOString()
    })
    return true
  } catch (error) {
    logger.error('Error approving cancellation request:', error)
    return false
  }
}

/**
 * Reject cancellation request
 * @param requestId - Cancellation request ID
 * @returns Success status
 */
export const rejectCancellationRequest = async (requestId: string): Promise<boolean> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, requestId)
    await updateDoc(docRef, {
      status: 'rejected',
      respondedAt: new Date().toISOString()
    })
    return true
  } catch (error) {
    logger.error('Error rejecting cancellation request:', error)
    return false
  }
}

/**
 * Get cancellation request by ID
 * @param requestId - Cancellation request ID
 * @returns Cancellation request or null
 */
export const getCancellationRequest = async (requestId: string): Promise<CancellationRequest | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, requestId)
    const docSnap = await getDoc(docRef)
    if (!docSnap.exists()) return null
    return {
      id: docSnap.id,
      ...docSnap.data()
    } as CancellationRequest
  } catch (error) {
    logger.error('Error getting cancellation request:', error)
    return null
  }
}
