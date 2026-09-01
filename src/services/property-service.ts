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
  limit
} from 'firebase/firestore'
import { ref, uploadBytes, deleteObject, getDownloadURL } from 'firebase/storage'
import { auth } from '../lib/firebase/client'
import { compressPropertyImage } from '../utils/image-compression'
import { validatePropertyImage } from './file-validation'
import { db, storage } from '../lib/firebase/client'
import { Property, PropertyType, Comment } from '../types'
import * as logger from './logger'
import {normalizePropertyImageUrls, storagePathFromImageSource} from '../lib/images'

const COLLECTION_NAME = 'properties'

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
  const data = snapshotDoc.data() as Omit<Property, 'id'>
  return normalizePropertyImageUrls({
    id: snapshotDoc.id,
    ...data
  })
}

// matchesSearch удалена вместе с getProperties — использовалась только там.

// getProperties и getAllPremiumProperties удалены (2026-08-31).
//
// Обе не вызывались ниоткуда: публичные списки давно собирает сервер через
// REST-клиент (src/app/queries.ts, kiraye/[city]/queries.ts). Их собственная
// сортировка по тарифу к тому же расходилась с общей: премиум считался
// действующим по одному лишь listingTier, без проверки срока.

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
      isActive: cleanedProperty.isActive ?? true,
      images: imageUrls.length > 0 ? imageUrls : property.images,
      createdAt: now,
      updatedAt: now,
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
    const currentData = current.exists()
      ? normalizePropertyImageUrls(current.data() as Property)
      : null

    // Upload new images if provided
    let newImageUrls: string[] = []
    if (newImageFiles && newImageFiles.length > 0) {
      newImageUrls = await uploadPropertyImages(newImageFiles)
    }

    // Clean up undefined values - Firestore doesn't accept undefined
    const cleanedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    ) as Partial<Property>
    if (cleanedUpdates.images) {
      cleanedUpdates.images = normalizePropertyImageUrls({images: cleanedUpdates.images}).images || []
    }

    const finalImages = [...(cleanedUpdates.images || currentData?.images || []), ...newImageUrls]

    const updateData = {
      ...cleanedUpdates,
      ...(newImageUrls.length > 0 && { images: finalImages }),
      updatedAt: new Date().toISOString()
    }

    await updateDoc(docRef, updateData)

    // Фото, убранные из массива при редактировании, удаляем из Storage — иначе
    // файлы остаются висеть навсегда. Только после успешной записи: если
    // updateDoc упадёт, объявление продолжит ссылаться на эти же URL.
    const removedImages = (currentData?.images || []).filter(
      (url) => !finalImages.includes(url)
    )
    if (removedImages.length > 0) {
      await deletePropertyImages(removedImages)
    }

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

    // Брони объявления, а вместе с ними и запросы на их отмену: иначе запрос
    // остаётся ссылаться в пустоту.
    const bookingsSnapshot = await getDocs(
      query(collection(db, 'bookings'), where('propertyId', '==', id))
    )
    for (const bookingDoc of bookingsSnapshot.docs) {
      const requests = await getDocs(
        query(collection(db, 'cancellationRequests'), where('bookingId', '==', bookingDoc.id))
      )
      for (const request of requests.docs) {
        await deleteDoc(request.ref)
      }
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
 * @returns {Promise<string[]>} Array of same-origin image API URLs
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
      // Проверка стоит здесь, а не в форме: путей загрузки несколько (кабинет,
      // редактор модератора), и обойти общий для них шаг нельзя. Раньше модуль
      // проверки вызывался только из тестов, а отказ приходил от Storage — без
      // объяснения, что именно не так с файлом.
      const check = validatePropertyImage(file)
      if (!check.valid) {
        throw new Error(check.error || 'Invalid image file')
      }

      const compressed = await compressPropertyImage(file)
      const timestamp = Date.now()
      const fileName = `properties/${userId}/${timestamp}_${compressed.name}`
      const storageRef = ref(storage, fileName)

      await uploadBytes(storageRef, compressed)
      // Полный адрес с токеном, а не путь /api/images: база общая с сайтом на
      // Vite, где такого маршрута нет, а Storage без токена отбивает App Check.
      // На чтении ссылка переписывается через normalizePropertyImageUrls.
      urls.push(await getDownloadURL(storageRef))
    } catch (error) {
      // Раньше сбой просто логировался, и файл молча пропадал: объявление
      // сохранялось с меньшим числом фотографий, а человек об этом не узнавал.
      logger.error('Error uploading image:', error)
      throw error instanceof Error ? error : new Error('Image upload failed')
    }
  }

  return urls
}

/**
 * Delete property images from Firebase Storage by URL
 * @param {string[]} urls - Array of same-origin or legacy Firebase image URLs to delete
 * @returns {Promise<void>}
 * @throws {Error} On storage delete failure (individual errors logged to console)
 * @example
 * await deletePropertyImages(['/api/images/properties/user/photo.webp'])
 */
export const deletePropertyImages = async (urls: string[]): Promise<void> => {
  for (const url of urls) {
    try {
      const path = storagePathFromImageSource(url)
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

    // Одобрять можно только то, что действительно ждёт модерации. Проверки не
    // было, а страница проверки открывается по прямой ссылке с любым id — так
    // черновик неоплаченного VIP/Premium можно было активировать в обход оплаты.
    if (currentData.status !== 'pending') {
      logger.warn(`Property ${id} is not pending moderation (status: ${currentData.status})`)
      return false
    }

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

    const data = current.data() as Property
    if (data.images?.length) {
      await deletePropertyImages(data.images)
    }

    // Брони удаляемого объявления уходят вместе с ним, а с ними и запросы на
    // отмену. Раньше их чистил только deleteProperty, а отклонение оставляло
    // висеть: в базе так осели брони, ссылающиеся на несуществующие объявления,
    // и вкладка модерации показывала их с подписью «объявление удалено».
    const bookingsSnapshot = await getDocs(
      query(collection(db, 'bookings'), where('propertyId', '==', id))
    )
    for (const bookingDoc of bookingsSnapshot.docs) {
      const requests = await getDocs(
        query(collection(db, 'cancellationRequests'), where('bookingId', '==', bookingDoc.id))
      )
      for (const request of requests.docs) {
        await deleteDoc(request.ref)
      }
      await deleteDoc(bookingDoc.ref)
    }

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
// addCommentToProperty удалена (2026-08-31): комментарии пишет серверный экшен
// `addCommentAction`, эта версия не вызывалась ниоткуда.

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
// addReplyToComment удалена (2026-08-31): ответы пишет серверный экшен
// `addReplyAction`, эта версия не вызывалась ниоткуда.

/**
 * Toggle like status for a property by a user
 * @param {string} propertyId - Property Firestore document ID
 * @param {string} userId - User Firestore ID performing the like toggle
 * @returns {Promise<boolean>} True on success, false if property not found or update fails
 * @throws {Error} On Firestore update failure
 * @example
 * const toggled = await toggleLikeProperty('prop_111', 'user_456')
 */
// toggleLikeProperty удалена (2026-08-31): не вызывалась ниоткуда, а правила
// Firestore после чистки и не пропустили бы запись в `likes` из браузера.

// addRatingToProperty и getUserRatingForProperty удалены (2026-08-31).
//
// Обе не вызывались ниоткуда — оценки давно ставит серверный экшен
// `addRatingAction` на странице объявления, а «своя» оценка приходит из
// `property/[id]/queries.ts`. Опасна была именно мёртвая версия: проверку
// «бронировал ли вообще» она делала в try/catch и при любом сбое писала в лог
// «Could not verify booking status, allowing rating anyway» — то есть пропускала
// оценку от человека без брони. Живой экшен в том же случае просто отказывает.

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
// incrementPropertyViews удалена (2026-08-31). Не вызывалась ниоткуда, и хорошо:
// она читала счётчик и записывала «прочитанное плюс один», то есть теряла
// просмотры при одновременных заходах. Живой путь — `recordPropertyView` на
// сервере, он использует атомарный increment Firestore.

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
