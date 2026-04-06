import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore'
import { db } from '../config/firebase'

export interface Comment {
  id: string
  userId: string
  userName: string
  userAvatar?: string
  text: string
  createdAt: string
  updatedAt?: string
}

export const commentsService = {
  /**
   * Add a comment to a property
   * @param {string} propertyId - Property Firestore document ID
   * @param {string} userId - User Firestore ID making the comment
   * @param {string} userName - Display name of the commenter
   * @param {string} text - Comment text content
   * @param {string} [userAvatar] - Optional URL to user's avatar
   * @returns {Promise<string>} ID of the created comment
   * @throws {Error} Comment creation or Firebase failure
   * @example
   * const commentId = await commentsService.addComment('prop_123', 'user_456', 'John', 'Great place!')
   */
  async addComment(propertyId: string, userId: string, userName: string, text: string, userAvatar?: string): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, `properties/${propertyId}/comments`), {
        userId,
        userName,
        userAvatar: userAvatar || '',
        text,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      return docRef.id
    } catch (error) {
      console.error('Error adding comment:', error)
      throw new Error('Failed to add comment. Please try again.')
    }
  },

  /**
   * Retrieve all comments for a property
   * @param {string} propertyId - Property Firestore document ID
   * @returns {Promise<Comment[]>} Array of comments for the property
   * @throws {Error} On Firestore query failure
   * @example
   * const comments = await commentsService.getComments('prop_789')
   */
  async getComments(propertyId: string): Promise<Comment[]> {
    try {
      const snapshot = await getDocs(collection(db, `properties/${propertyId}/comments`))

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      } as Comment))
    } catch (error) {
      console.error('Error fetching comments:', error)
      throw new Error('Failed to load comments.')
    }
  },

  /**
   * Update the text of an existing comment
   * @param {string} propertyId - Property Firestore document ID
   * @param {string} commentId - Comment Firestore document ID
   * @param {string} text - New comment text
   * @returns {Promise<void>}
   * @throws {Error} On Firestore update failure
   * @example
   * await commentsService.updateComment('prop_111', 'comment_222', 'Updated text')
   */
  async updateComment(propertyId: string, commentId: string, text: string): Promise<void> {
    try {
      const docRef = doc(db, `properties/${propertyId}/comments/${commentId}`)
      await updateDoc(docRef, {
        text,
        updatedAt: serverTimestamp()
      })
    } catch (error) {
      console.error('Error updating comment:', error)
      throw new Error('Failed to update comment.')
    }
  },

  /**
   * Delete a comment from a property
   * @param {string} propertyId - Property Firestore document ID
   * @param {string} commentId - Comment Firestore document ID to delete
   * @returns {Promise<void>}
   * @throws {Error} On Firestore delete failure
   * @example
   * await commentsService.deleteComment('prop_333', 'comment_444')
   */
  async deleteComment(propertyId: string, commentId: string): Promise<void> {
    try {
      const docRef = doc(db, `properties/${propertyId}/comments/${commentId}`)
      await deleteDoc(docRef)
    } catch (error) {
      console.error('Error deleting comment:', error)
      throw new Error('Failed to delete comment.')
    }
  },

  /**
   * Toggle like status for a property (add or remove user from likes array)
   * @param {string} propertyId - Property Firestore document ID
   * @param {string} userId - User Firestore ID performing the toggle
   * @param {boolean} liked - Current like status (true if currently liked)
   * @returns {Promise<void>}
   * @throws {Error} On Firestore update failure
   * @example
   * await commentsService.toggleLike('prop_555', 'user_666', false) // Add like
   * await commentsService.toggleLike('prop_555', 'user_666', true) // Remove like
   */
  async toggleLike(propertyId: string, userId: string, liked: boolean): Promise<void> {
    try {
      const docRef = doc(db, 'properties', propertyId)

      if (liked) {
        await updateDoc(docRef, {
          likes: arrayRemove(userId)
        })
      } else {
        await updateDoc(docRef, {
          likes: arrayUnion(userId)
        })
      }
    } catch (error) {
      console.error('Error toggling like:', error)
      throw new Error('Failed to toggle like.')
    }
  }
}
