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
  // Add comment to property
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

  // Get comments for property
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

  // Update comment
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

  // Delete comment
  async deleteComment(propertyId: string, commentId: string): Promise<void> {
    try {
      const docRef = doc(db, `properties/${propertyId}/comments/${commentId}`)
      await deleteDoc(docRef)
    } catch (error) {
      console.error('Error deleting comment:', error)
      throw new Error('Failed to delete comment.')
    }
  },

  // Toggle like
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
