import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  QueryConstraint,
  limit,
  startAfter,
  DocumentSnapshot
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '../config/firebase'
import { Property } from '../types'

interface CreateListingPayload extends Omit<Property, 'id' | 'createdAt' | 'updatedAt'> {}

export const listingService = {
  // Get listings by owner
  async getListingsByOwner(userId: string, options?: { limit?: number; startAfter?: DocumentSnapshot }) {
    try {
      const constraints: QueryConstraint[] = [where('ownerId', '==', userId)]

      if (options?.limit) {
        constraints.push(limit(options.limit))
      }
      if (options?.startAfter) {
        constraints.push(startAfter(options.startAfter))
      }

      const q = query(collection(db, 'properties'), ...constraints)
      const snapshot = await getDocs(q)

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as (Property & { id: string })[]
    } catch (error) {
      console.error('Error fetching listings:', error)
      throw error
    }
  },

  // Get all listings (for browse)
  async getAllListings(options?: { limit?: number; startAfter?: DocumentSnapshot }) {
    try {
      const constraints: QueryConstraint[] = [where('status', '==', 'active')]

      if (options?.limit) {
        constraints.push(limit(options.limit))
      }
      if (options?.startAfter) {
        constraints.push(startAfter(options.startAfter))
      }

      const q = query(collection(db, 'properties'), ...constraints)
      const snapshot = await getDocs(q)

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as (Property & { id: string })[]
    } catch (error) {
      console.error('Error fetching all listings:', error)
      throw error
    }
  },

  // Create listing
  async createListing(payload: CreateListingPayload) {
    try {
      const docRef = await addDoc(collection(db, 'properties'), {
        ...payload,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      return docRef.id
    } catch (error) {
      console.error('Error creating listing:', error)
      throw error
    }
  },

  // Update listing
  async updateListing(propertyId: string, updates: Partial<Property>) {
    try {
      const docRef = doc(db, 'properties', propertyId)
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      })
    } catch (error) {
      console.error('Error updating listing:', error)
      throw error
    }
  },

  // Delete listing
  async deleteListing(propertyId: string) {
    try {
      const docRef = doc(db, 'properties', propertyId)
      await deleteDoc(docRef)
    } catch (error) {
      console.error('Error deleting listing:', error)
      throw error
    }
  },

  // Upload property image
  async uploadPropertyImage(propertyId: string, file: File): Promise<string> {
    try {
      const fileName = `${Date.now()}_${file.name}`
      const storageRef = ref(storage, `properties/${propertyId}/${fileName}`)

      const snapshot = await uploadBytes(storageRef, file)
      const downloadUrl = await getDownloadURL(snapshot.ref)

      return downloadUrl
    } catch (error) {
      console.error('Error uploading image:', error)
      throw error
    }
  },

  // Delete property image
  async deletePropertyImage(imageUrl: string) {
    try {
      const imageRef = ref(storage, imageUrl)
      await deleteObject(imageRef)
    } catch (error) {
      console.error('Error deleting image:', error)
      throw error
    }
  },

  // Batch upload images
  async batchUploadImages(propertyId: string, files: File[]): Promise<string[]> {
    try {
      const urls: string[] = []

      for (const file of files) {
        const url = await this.uploadPropertyImage(propertyId, file)
        urls.push(url)
      }

      return urls
    } catch (error) {
      console.error('Error batch uploading images:', error)
      throw error
    }
  }
}
