import { db } from '../lib/firebase/client'
import * as logger from './logger'
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'

/**
 * Добавить или убрать объявление из избранного.
 *
 * Проверка CSRF-токена отсюда убрана вместе со всей службой: токен и создавался,
 * и сверялся в одном и том же браузере через sessionStorage, то есть совпадал
 * всегда и не защищал ни от чего. Настоящая защита у этой записи другая —
 * правила Firestore (менять можно только собственную отметку) и App Check.
 *
 * @returns {Promise<boolean>} True on success
 */
export const toggleFavorite = async (
  propertyId: string,
  userId: string,
  isFavorited: boolean
): Promise<boolean> => {
  try {
    const propertyRef = doc(db, 'properties', propertyId)
    
    if (isFavorited) {
      // Remove from favorites
      await updateDoc(propertyRef, {
        favorites: arrayRemove(userId)
      })
    } else {
      // Add to favorites
      await updateDoc(propertyRef, {
        favorites: arrayUnion(userId)
      })
    }
    
    return true
  } catch (error) {
    logger.error('Error toggling favorite:', error)
    throw error
  }
}

/**
 * Check if a property is favorited by a user
 * @param {string[] | undefined} propertyFavorites - Array of user IDs that favorited the property
 * @param {string} userId - User Firestore ID to check
 * @returns {boolean} True if property is favorited by user
 * @example
 * const isFavored = isPropertyFavorited(['user_123', 'user_456'], 'user_123') // true
 */
export const isPropertyFavorited = (
  propertyFavorites: string[] | undefined,
  userId: string
): boolean => {
  return propertyFavorites?.includes(userId) ?? false
}

/**
 * Get the count of users who favorited a property
 * @param {string[] | undefined} favorites - Array of user IDs that favorited the property
 * @returns {number} Number of favorites (0 if undefined)
 * @example
 * const count = getFavoriteCount(['user_123', 'user_456']) // 2
 */
export const getFavoriteCount = (favorites: string[] | undefined): number => {
  return favorites?.length ?? 0
}
