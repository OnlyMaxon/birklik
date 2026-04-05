import { db } from '../config/firebase'
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'

/**
 * Toggle favorite status for a property
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
 * Get all favorited properties for a user
 */
export const getUserFavorites = async () => {
  try {
    // Since we store favorites by property ID, we need to query properties
    // where the favorites array contains the userId
    // This requires a collection query in a real implementation
    // For now, return empty - this will be fetched via parent component
    return []
  } catch (error) {
    console.error('Error getting favorites:', error)
    throw error
  }
}

/**
 * Check if a property is favorited by user
 */
export const isPropertyFavorited = (
  propertyFavorites: string[] | undefined,
  userId: string
): boolean => {
  return propertyFavorites?.includes(userId) ?? false
}

/**
 * Get favorite count for a property
 */
export const getFavoriteCount = (favorites: string[] | undefined): number => {
  return favorites?.length ?? 0
}
