import { db } from '../config/firebase'
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'

/**
 * Toggle favorite status for a property for a user (add or remove from favorites)
 * @param {string} propertyId - Property Firestore document ID
 * @param {string} userId - User Firestore ID
 * @param {boolean} isFavorited - Current favorite status (true if currently favorited)
 * @returns {Promise<boolean>} True on success
 * @throws {Error} On Firestore update failure
 * @example
 * await toggleFavorite('prop_123', 'user_456', false) // Add to favorites
 * await toggleFavorite('prop_123', 'user_456', true) // Remove from favorites
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
    console.error('Error toggling favorite:', error)
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
