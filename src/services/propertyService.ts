import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  DocumentSnapshot,
  QueryConstraint
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { auth } from '../config/firebase'
import { compressPropertyImage } from '../utils/imageCompression'
import { db, storage } from '../config/firebase'
import { Property, PropertyType, Language, Comment } from '../types'
import * as logger from './logger'

const COLLECTION_NAME = 'properties'
const PAGE_SIZE = 12

const isPubliclyVisible = (property: Property): boolean => {
  // Older records may not have status; treat them as active.
  if (!property.status) return true
  return property.status === 'active'
}

export interface PropertyFilters {
  type?: PropertyType | 'all'
  district?: string
  city?: string
  minPrice?: number
  maxPrice?: number
  minRooms?: number
  maxRooms?: number
  search?: string
}

const mapDocToProperty = (snapshotDoc: { id: string; data: () => unknown }): Property => {
  return {
    id: snapshotDoc.id,
    ...(snapshotDoc.data() as Omit<Property, 'id'>)
  }
}

const matchesSearch = (property: Property, searchTerm?: string, lang: Language = 'az'): boolean => {
  if (!searchTerm) return true

  const searchLower = searchTerm.toLowerCase().trim()
  if (!searchLower) return true

  const title = property.title?.[lang] || ''
  const description = property.description?.[lang] || ''
  const address = property.address?.[lang] || ''
  const district = property.district || ''

  return (
    title.toLowerCase().includes(searchLower) ||
    description.toLowerCase().includes(searchLower) ||
    address.toLowerCase().includes(searchLower) ||
    district.toLowerCase().includes(searchLower)
  )
}

/**
 * Retrieve paginated properties list with optional filtering and sorting
 * @param {PropertyFilters} [filters] - Optional filter criteria (type, district, price range, rooms, search)
 * @param {DocumentSnapshot} [lastDoc] - Cursor for pagination, obtained from previous query
 * @returns {Promise<{ properties: Property[]; lastDoc: DocumentSnapshot | null }>} Array of properties and cursor for next page
 * @throws {Error} On Firestore query failure or network error
 * @example
 * const { properties, lastDoc } = await getProperties(
 *   { type: 'apartment', minPrice: 100, maxPrice: 500 }
 * )
 */
export const getProperties = async (
  filters?: PropertyFilters,
  lastDoc?: DocumentSnapshot
): Promise<{ properties: Property[]; lastDoc: DocumentSnapshot | null }> => {
  try {
    const constraints: QueryConstraint[] = []

    // Status filter - only active properties
    constraints.push(where('status', '==', 'active'))

    // Add filters
    if (filters?.type && filters.type !== 'all') {
      constraints.push(where('type', '==', filters.type))
    }
    if (filters?.district) {
      constraints.push(where('district', '==', filters.district))
    }
    if (filters?.city) {
      constraints.push(where('city', '==', filters.city))
    }
    if (filters?.minPrice) {
      constraints.push(where('price.daily', '>=', filters.minPrice))
    }
    if (filters?.maxPrice) {
      constraints.push(where('price.daily', '<=', filters.maxPrice))
    }
    if (filters?.minRooms) {
      constraints.push(where('rooms', '>=', filters.minRooms))
    }

    // Only add ordering without filters to avoid index requirement
    constraints.push(orderBy('createdAt', 'desc'))
    constraints.push(limit(PAGE_SIZE * 2))

    if (lastDoc) {
      constraints.push(startAfter(lastDoc))
    }

    const q = query(collection(db, COLLECTION_NAME), ...constraints)
    const snapshot = await getDocs(q)

    const properties = snapshot.docs
      .map(mapDocToProperty)
      .filter(property => {
        if (!isPubliclyVisible(property)) return false
        if (filters?.maxRooms && property.rooms > filters.maxRooms) return false
        return matchesSearch(property, filters?.search)
      })
      // Sort by featured first, then by date
      .sort((a, b) => {
        if (a.isFeatured !== b.isFeatured) {
          return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0)
        }
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      })
      .slice(0, PAGE_SIZE)

    const newLastDoc = snapshot.docs.length > 0 
      ? snapshot.docs[snapshot.docs.length - 1] 
      : null

    return { properties, lastDoc: newLastDoc }
  } catch (error) {
    logger.error('Error getting properties:', error)
    return { properties: [], lastDoc: null }
  }
}

/**
 * Fetch a single property by its Firestore document ID
 * @param {string} id - The unique property document identifier
 * @returns {Promise<Property | null>} Property object or null if not found
 * @throws {Error} On Firestore query failure
 * @example
 * const property = await getPropertyById('prop_123')
 * if (property) console.log(property.title)
 */
export const getPropertyById = async (id: string): Promise<Property | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      return mapDocToProperty(docSnap)
    }
    return null
  } catch (error) {
    logger.error('Error getting property:', error)
    return null
  }
}

/**
 * Retrieve all properties owned by a specific user
 * @param {string} ownerId - The user/owner Firestore ID
 * @returns {Promise<Property[]>} Array of properties owned by user, ordered by creation date (newest first)
 * @throws {Error} On Firestore query failure
 * @example
 * const myProperties = await getPropertiesByOwner('user_456')
 */
export const getPropertiesByOwner = async (ownerId: string): Promise<Property[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc')
    )
    const snapshot = await getDocs(q)

    return snapshot.docs.map(mapDocToProperty)
  } catch (error) {
    logger.error('Error getting user properties:', error)
    return []
  }
}

/**
 * Create a new property listing with optional image uploads
 * @param {Omit<Property, 'id' | 'createdAt' | 'updatedAt'>} property - Property data (excluding id, timestamps)
 * @param {File[]} [imageFiles] - Optional image files to upload to Firebase Storage
 * @returns {Promise<Property | null>} Created property with id and timestamps, or null on failure
 * @throws {Error} On Firestore write or image upload failure
 * @example
 * const newProp = await createProperty({
 *   title: { az: 'Apartment', en: 'Apartment' },
 *   price: { daily: 50 },
 *   ownerId: 'user_123'
 * })
 */
export const createProperty = async (
  property: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>,
  imageFiles?: File[]
): Promise<Property | null> => {
  try {
    // Upload images if provided
    let imageUrls: string[] = []
    if (imageFiles && imageFiles.length > 0) {
      imageUrls = await uploadPropertyImages(imageFiles)
    }

    const now = new Date().toISOString()

    // Clean up undefined values - Firestore doesn't accept undefined
    const cleanedProperty = Object.fromEntries(
      Object.entries(property).filter(([_, value]) => value !== undefined)
    ) as Omit<Property, 'id' | 'createdAt' | 'updatedAt'>

    const propertyData = {
      ...cleanedProperty,
      images: imageUrls.length > 0 ? imageUrls : property.images,
      createdAt: now,
      updatedAt: now,
      status: 'pending'
    }

    const docRef = await addDoc(collection(db, COLLECTION_NAME), propertyData)
    return { id: docRef.id, ...propertyData } as Property
  } catch (error) {
    logger.error('Error creating property:', error)
    return null
  }
}

/**
 * Update property fields with optional new image uploads
 * @param {string} id - Property Firestore document ID
 * @param {Partial<Property>} updates - Partial property object with fields to update
 * @param {File[]} [newImageFiles] - Optional new image files to upload and append
 * @returns {Promise<boolean>} True on success, false on failure
 * @throws {Error} On Firestore update or image upload failure
 * @example
 * const success = await updateProperty('prop_789', { price: { daily: 75 } })
 */
export const updateProperty = async (
  id: string,
  updates: Partial<Property>,
  newImageFiles?: File[]
): Promise<boolean> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)
    const current = await getDoc(docRef)
    const currentData = current.exists() ? (current.data() as Property) : null

    // Upload new images if provided
    let newImageUrls: string[] = []
    if (newImageFiles && newImageFiles.length > 0) {
      newImageUrls = await uploadPropertyImages(newImageFiles)
    }

    // Clean up undefined values - Firestore doesn't accept undefined
    const cleanedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    ) as Partial<Property>

    const updateData = {
      ...cleanedUpdates,
      ...(newImageUrls.length > 0 && { 
        images: [...(updates.images || currentData?.images || []), ...newImageUrls]
      }),
      updatedAt: new Date().toISOString()
    }

    await updateDoc(docRef, updateData)
    return true
  } catch (error) {
    logger.error('Error updating property:', error)
    return false
  }
}

/**
 * Delete a property and all associated images and bookings from Firestore and Storage
 * @param {string} id - Property Firestore document ID
 * @returns {Promise<boolean>} True on success, false on failure
 * @throws {Error} On Firestore delete or image deletion failure
 * @example
 * const deleted = await deleteProperty('prop_999')
 */
export const deleteProperty = async (id: string): Promise<boolean> => {
  try {
    // Get property to delete images
    const property = await getPropertyById(id)
    if (property?.images) {
      await deletePropertyImages(property.images)
    }

    // Delete all bookings for this property
    const bookingsRef = collection(db, 'bookings')
    const bookingsQuery = query(bookingsRef, where('propertyId', '==', id))
    const bookingsSnapshot = await getDocs(bookingsQuery)
    
    for (const bookingDoc of bookingsSnapshot.docs) {
      await deleteDoc(bookingDoc.ref)
    }

    // Delete the property itself
    await deleteDoc(doc(db, COLLECTION_NAME, id))
    return true
  } catch (error) {
    logger.error('Error deleting property:', error)
    return false
  }
}

/**
 * Upload property images to Firebase Storage
 * @param {File[]} files - Array of image files to upload
 * @returns {Promise<string[]>} Array of download URLs for uploaded images
 * @throws {Error} On storage upload failure (individual errors logged to console)
 * @example
 * const urls = await uploadPropertyImages([imageFile1, imageFile2])
 */
export const uploadPropertyImages = async (files: File[]): Promise<string[]> => {
  const userId = auth.currentUser?.uid
  if (!userId) throw new Error('User not authenticated')

  const urls: string[] = []

  for (const file of files) {
    try {
      const compressed = await compressPropertyImage(file)
      const timestamp = Date.now()
      const fileName = `properties/${userId}/${timestamp}_${compressed.name}`
      const storageRef = ref(storage, fileName)

      await uploadBytes(storageRef, compressed)
      const url = await getDownloadURL(storageRef)
      urls.push(url)
    } catch (error) {
      logger.error('Error uploading image:', error)
    }
  }

  return urls
}

/**
 * Delete property images from Firebase Storage by URL
 * @param {string[]} urls - Array of Firebase Storage download URLs to delete
 * @returns {Promise<void>}
 * @throws {Error} On storage delete failure (individual errors logged to console)
 * @example
 * await deletePropertyImages(['https://firebasestorage.googleapis.com/...',...])
 */
export const deletePropertyImages = async (urls: string[]): Promise<void> => {
  for (const url of urls) {
    try {
      // Extract path from URL
      const path = decodeURIComponent(url.split('/o/')[1]?.split('?')[0] || '')
      if (path) {
        const storageRef = ref(storage, path)
        await deleteObject(storageRef)
      }
    } catch (error) {
      logger.error('Error deleting image:', error)
    }
  }
}

/**
 * Retrieve all properties awaiting moderator approval
 * @returns {Promise<Property[]>} Array of pending properties, ordered by creation date (newest first)
 * @throws {Error} On Firestore query failure
 * @example
 * const pendingList = await getPendingProperties()
 */
export const getPendingProperties = async (): Promise<Property[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('status', '==', 'pending')
    )
    const snapshot = await getDocs(q)

    return snapshot.docs
      .map(mapDocToProperty)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  } catch (error) {
    logger.error('Error getting pending properties:', error)
    return []
  }
}

/**
 * Get all published properties for moderation
 * @returns {Promise<Property[]>} Array of all published properties
 */
export const getAllProperties = async (): Promise<Property[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('createdAt', 'desc')
    )
    const snapshot = await getDocs(q)

    return snapshot.docs.map(mapDocToProperty)
  } catch (error) {
    logger.error('Error getting all properties:', error)
    return []
  }
}

/**
 * Get count of properties pending moderation
 * @returns {Promise<number>} Count of properties with status 'pending'
 */
export const getPendingModerationCount = async (): Promise<number> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('status', '==', 'pending')
    )
    const snapshot = await getDocs(q)
    return snapshot.size
  } catch (error) {
    logger.error('Error getting pending moderation count:', error)
    return 0
  }
}

/**
 * Approve a pending property and make it publicly visible
 * @param {string} id - Property Firestore document ID
 * @returns {Promise<boolean>} True on success, false if property not found or update fails
 * @throws {Error} On Firestore update failure
 * @example
 * const approved = await approveProperty('prop_456')
 */
export const approveProperty = async (id: string): Promise<boolean> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)
    const current = await getDoc(docRef)

    if (!current.exists()) {
      return false
    }

    const currentData = current.data() as Partial<Property>

    await updateDoc(docRef, {
      status: 'active',
      isFeatured: currentData.listingTier === 'premium',
      updatedAt: new Date().toISOString()
    })

    return true
  } catch (error) {
    logger.error('Error approving property:', error)
    return false
  }
}

/**
 * Reject a pending property - removes it from moderation queue
 * @param {string} id - Property Firestore document ID
 * @returns {Promise<boolean>} True on success, false if property not found or update fails
 * @throws {Error} On Firestore update failure
 * @example
 * const rejected = await rejectProperty('prop_456')
 */
export const rejectProperty = async (id: string): Promise<boolean> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)
    const current = await getDoc(docRef)

    if (!current.exists()) {
      return false
    }

    // Delete the rejected property from public listings
    await deleteDoc(docRef)

    return true
  } catch (error) {
    logger.error('Error rejecting property:', error)
    return false
  }
}

/**
 * Add a comment to a property
 * @param {string} propertyId - Property Firestore document ID
 * @param {string} userId - User Firestore ID making the comment
 * @param {string} userName - Display name of the commenter
 * @param {string | undefined} userAvatar - Optional URL to user's avatar image
 * @param {string} text - Comment text content
 * @param {string} csrfToken - CSRF token for validation
 * @returns {Promise<boolean>} True on success, false if property not found or update fails
 */
export const addCommentToProperty = async (
  propertyId: string,
  userId: string,
  userName: string,
  userAvatar: string | undefined,
  text: string,
  csrfToken: string
): Promise<boolean> => {
  try {
    const { validateCsrfToken } = await import('./csrfService')
    if (!validateCsrfToken(csrfToken)) {
      logger.error('CSRF token validation failed for addCommentToProperty')
      throw new Error('Security validation failed. Please try again.')
    }

    const docRef = doc(db, COLLECTION_NAME, propertyId)
    const current = await getDoc(docRef)

    if (!current.exists()) {
      return false
    }

    const currentData = current.data() as Property
    const comments = currentData.comments || []

    const newComment = {
      id: `${Date.now()}_${userId}`,
      userId,
      userName,
      userAvatar,
      text,
      createdAt: new Date().toISOString()
    }

    await updateDoc(docRef, {
      comments: [...comments, newComment],
      updatedAt: new Date().toISOString()
    })

    return true
  } catch (error) {
    logger.error('Error adding comment:', error)
    return false
  }
}

/**
 * Add a reply to an existing comment
 * @param {string} propertyId - Property Firestore document ID
 * @param {string} parentCommentId - Parent comment ID
 * @param {string} userId - User Firestore ID
 * @param {string} userName - User name
 * @param {string} userAvatar - User avatar URL
 * @param {string} text - Reply text
 * @returns {Promise<boolean>} True on success, false if property or parent comment not found
 */
export const addReplyToComment = async (
  propertyId: string,
  parentCommentId: string,
  userId: string,
  userName: string,
  userAvatar: string | undefined,
  text: string
): Promise<boolean> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, propertyId)
    const current = await getDoc(docRef)

    if (!current.exists()) {
      return false
    }

    const currentData = current.data() as Property
    const comments = currentData.comments || []

    // Find and update the parent comment
    const updatedComments = comments.map(comment => {
      if (comment.id === parentCommentId) {
        const newReply = {
          id: `${Date.now()}_${userId}`,
          userId,
          userName,
          userAvatar,
          text,
          createdAt: new Date().toISOString(),
          parentCommentId
        }
        return {
          ...comment,
          replies: [...(comment.replies || []), newReply]
        }
      }
      return comment
    })

    await updateDoc(docRef, {
      comments: updatedComments,
      updatedAt: new Date().toISOString()
    })

    return true
  } catch (error) {
    logger.error('Error adding reply:', error)
    return false
  }
}

/**
 * Toggle like status for a property by a user
 * @param {string} propertyId - Property Firestore document ID
 * @param {string} userId - User Firestore ID performing the like toggle
 * @returns {Promise<boolean>} True on success, false if property not found or update fails
 * @throws {Error} On Firestore update failure
 * @example
 * const toggled = await toggleLikeProperty('prop_111', 'user_456')
 */
export const toggleLikeProperty = async (propertyId: string, userId: string): Promise<boolean> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, propertyId)
    const current = await getDoc(docRef)

    if (!current.exists()) {
      return false
    }

    const currentData = current.data() as Property
    const likes = currentData.likes || []
    const isLiked = likes.includes(userId)

    const updatedLikes = isLiked
      ? likes.filter(id => id !== userId)
      : [...likes, userId]

    await updateDoc(docRef, {
      likes: updatedLikes,
      updatedAt: new Date().toISOString()
    })

    return true
  } catch (error) {
    logger.error('Error toggling like:', error)
    return false
  }
}

/**
 * Add rating to a property by a user (1-5 stars) with CSRF protection
 * Only users who have booked the property can rate it
 * @param {string} propertyId - Property Firestore document ID
 * @param {string} userId - User Firestore ID
 * @param {number} rating - Rating value (1-5)
 * @param {string} userName - User's name for notification
 * @param {string} csrfToken - CSRF token for validation
 * @returns {Promise<{success: boolean; hasBooked?: boolean}>} Success status and booking check
 */
export const addRatingToProperty = async (
  propertyId: string,
  userId: string,
  rating: number,
  userName: string = 'User',
  csrfToken: string = ''
): Promise<{ success: boolean; hasBooked?: boolean }> => {
  try {
    const { validateCsrfToken } = await import('./csrfService')
    if (!validateCsrfToken(csrfToken)) {
      logger.error('CSRF token validation failed for addRatingToProperty')
      throw new Error('Security validation failed. Please try again.')
    }

    if (rating < 1 || rating > 5) {
      logger.error('Invalid rating: must be 1-5')
      return { success: false }
    }

    const docRef = doc(db, COLLECTION_NAME, propertyId)
    const current = await getDoc(docRef)

    if (!current.exists()) {
      return { success: false }
    }

    const currentData = current.data() as Record<string, unknown>
    
    // Check if user has booked this property
    try {
      const { hasUserBookedProperty } = await import('./bookingService')
      const hasBooked = await hasUserBookedProperty(userId, propertyId)
      if (!hasBooked) {
        logger.warn(`User ${userId} attempted to rate property ${propertyId} without booking`)
        return { success: false, hasBooked: false }
      }
    } catch (error) {
      logger.warn('Could not verify booking status, allowing rating anyway')
    }

    const ratings = (currentData?.ratings as Record<string, number>) || {}
    ratings[userId] = rating

    // Calculate average rating
    const ratingValues = Object.values(ratings).filter((v): v is number => typeof v === 'number')
    const averageRating = ratingValues.length > 0 
      ? ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length 
      : 0

    await updateDoc(docRef, {
      ratings,
      rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      reviews: ratingValues.length, // Total number of reviews
      updatedAt: new Date().toISOString()
    })

    // Create notification for property owner
    try {
      const ownerId = currentData?.ownerId as string
      const { createRatingNotification } = await import('./notificationsService')
      if (ownerId) {
        await createRatingNotification(ownerId, {
          type: 'rating',
          title: `⭐ ${rating} stars`,
          message: `${userName} rated your property with ${rating} stars`,
          propertyId,
          raterName: userName,
          ratingValue: rating,
          relatedId: propertyId,
          relatedUserName: userName,
          actionUrl: `/property/${propertyId}`,
          read: false
        })
      }
    } catch (error) {
      logger.warn('Could not create rating notification:', error)
    }

    return { success: true }
  } catch (error) {
    logger.error('Error adding rating:', error)
    return { success: false }
  }
}

/**
 * Get user's rating for a property
 * @param {string} propertyId - Property Firestore document ID
 * @param {string} userId - User Firestore ID
 * @returns {Promise<number | null>} User's rating (1-5) or null if not rated
 */
export const getUserRatingForProperty = async (propertyId: string, userId: string): Promise<number | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, propertyId)
    const current = await getDoc(docRef)

    if (!current.exists()) {
      return null
    }

    const currentData = current.data() as Record<string, unknown>
    const ratings = (currentData?.ratings as Record<string, number>) || {}
    
    return typeof ratings[userId] === 'number' ? ratings[userId] : null
  } catch (error) {
    logger.error('Error getting user rating:', error)
    return null
  }
}

/**
 * Delete a comment from a property
 * @param {string} propertyId - Property Firestore document ID
 * @param {string} commentId - Comment ID to delete
 * @returns {Promise<boolean>} True on success, false if property not found or update fails
 * @throws {Error} On Firestore update failure
 * @example
 * const deleted = await deleteCommentFromProperty('prop_222', 'comment_123')
 */
export const deleteCommentFromProperty = async (
  propertyId: string,
  commentId: string
): Promise<boolean> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, propertyId)
    const current = await getDoc(docRef)

    if (!current.exists()) {
      return false
    }

    const currentData = current.data() as Property
    const comments = currentData.comments || []

    const updatedComments = comments.filter(comment => comment.id !== commentId)

    await updateDoc(docRef, {
      comments: updatedComments,
      updatedAt: new Date().toISOString()
    })

    return true
  } catch (error) {
    logger.error('Error deleting comment:', error)
    return false
  }
}

/**
 * Increment the view count for a property
 * @param {string} propertyId - Property Firestore document ID
 * @returns {Promise<boolean>} True on success, false if property not found or update fails
 * @throws {Error} On Firestore update or increment failure
 * @example
 * const incremented = await incrementPropertyViews('prop_333')
 */
export const incrementPropertyViews = async (propertyId: string): Promise<boolean> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, propertyId)
    const current = await getDoc(docRef)

    if (!current.exists()) {
      return false
    }

    const currentViews = (current.data() as Property).views || 0

    await updateDoc(docRef, {
      views: currentViews + 1,
      updatedAt: new Date().toISOString()
    })

    return true
  } catch (error) {
    logger.error('Error incrementing views:', error)
    return false
  }
}

/**
 * Get all comments from all properties for moderation
 * @returns Promise<Array<{ comment; propertyId; propertyTitle; }>>
 */
export interface CommentWithProperty {
  comment: Comment
  propertyId: string
  propertyTitle: string
}

export const getAllCommentsForModeration = async (): Promise<CommentWithProperty[]> => {
  try {
    const querySnapshot = await getDocs(
      query(
        collection(db, COLLECTION_NAME),
        where('status', '==', 'active'),
        limit(500) // Get active properties
      )
    )

    const allComments: CommentWithProperty[] = []

    for (const propertyDoc of querySnapshot.docs) {
      const property = propertyDoc.data() as Property
      const comments = property.comments || []

      for (const comment of comments) {
        allComments.push({
          comment,
          propertyId: propertyDoc.id,
          propertyTitle: property.title?.az || property.title?.en || 'Unknown'
        })
      }
    }

    // Sort by newest first
    return allComments.sort((a, b) =>
      new Date(b.comment.createdAt).getTime() - new Date(a.comment.createdAt).getTime()
    )
  } catch (error) {
    logger.error('Error getting comments for moderation:', error)
    return []
  }
}
