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
import * as logger from './logger'

interface CreateListingPayload extends Omit<Property, 'id' | 'createdAt' | 'updatedAt'> {}

export const listingService = {
  /**
   * Retrieve all listings created by a specific user/owner
   * @param {string} userId - User Firestore ID
   * @param {Object} [options] - Query options
   * @param {number} [options.limit] - Maximum number of listings to return
   * @param {DocumentSnapshot} [options.startAfter] - Cursor for pagination
   * @returns {Promise<(Property & { id: string })[]>} Array of user's listings
   * @throws {Error} On Firestore query failure
   * @example
   * const listings = await listingService.getListingsByOwner('user_123')
   */
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
      logger.error('Error fetching listings:', error)
      throw error
    }
  },

  /**
   * Retrieve all active listings (for public browse)
   * @param {Object} [options] - Query options
   * @param {number} [options.limit] - Maximum number of listings to return
   * @param {DocumentSnapshot} [options.startAfter] - Cursor for pagination
   * @returns {Promise<(Property & { id: string })[]>} Array of active listings
   * @throws {Error} On Firestore query failure
   * @example
   * const listings = await listingService.getAllListings({ limit: 20 })
   */
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
      logger.error('Error fetching all listings:', error)
      throw error
    }
  },

  /**
   * Create a new listing (property) with pending status awaiting moderator approval
   * @param {CreateListingPayload} payload - Property data for new listing
   * @returns {Promise<string>} ID of created listing
   * @throws {Error} On Firestore write failure
   * @example
   * const listingId = await listingService.createListing({
   *   title: { az: 'Apartment', en: 'Apartment' },
   *   price: { daily: 100 },
   *   ownerId: 'user_123'
   * })
   */
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
      logger.error('Error creating listing:', error)
      throw error
    }
  },

  /**
   * Update an existing listing with partial property data
   * @param {string} propertyId - Property Firestore document ID
   * @param {Partial<Property>} updates - Partial property object with fields to update
   * @returns {Promise<void>}
   * @throws {Error} On Firestore update failure
   * @example
   * await listingService.updateListing('prop_456', { price: { daily: 120 } })
   */
  async updateListing(propertyId: string, updates: Partial<Property>) {
    try {
      const docRef = doc(db, 'properties', propertyId)
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      })
    } catch (error) {
      logger.error('Error updating listing:', error)
      throw error
    }
  },

  /**
   * Delete a listing and all associated data
   * @param {string} propertyId - Property Firestore document ID
   * @returns {Promise<void>}
   * @throws {Error} On Firestore delete failure
   * @example
   * await listingService.deleteListing('prop_789')
   */
  async deleteListing(propertyId: string) {
    try {
      const docRef = doc(db, 'properties', propertyId)
      await deleteDoc(docRef)
    } catch (error) {
      logger.error('Error deleting listing:', error)
      throw error
    }
  },

  /**
   * Upload a single property image to Firebase Storage
   * @param {string} propertyId - Property Firestore document ID
   * @param {File} file - Image file to upload
   * @returns {Promise<string>} Download URL of the uploaded image
   * @throws {Error} On storage upload failure
   * @example
   * const url = await listingService.uploadPropertyImage('prop_111', imageFile)
   */
  async uploadPropertyImage(propertyId: string, file: File): Promise<string> {
    try {
      const fileName = `${Date.now()}_${file.name}`
      const storageRef = ref(storage, `properties/${propertyId}/${fileName}`)

      const snapshot = await uploadBytes(storageRef, file)
      const downloadUrl = await getDownloadURL(snapshot.ref)

      return downloadUrl
    } catch (error) {
      logger.error('Error uploading image:', error)
      throw error
    }
  },

  /**
   * Delete a property image from Firebase Storage
   * @param {string} imageUrl - Firebase Storage download URL or path
   * @returns {Promise<void>}
   * @throws {Error} On storage delete failure
   * @example
   * await listingService.deletePropertyImage('https://firebasestorage.googleapis.com/...')
   */
  async deletePropertyImage(imageUrl: string) {
    try {
      const imageRef = ref(storage, imageUrl)
      await deleteObject(imageRef)
    } catch (error) {
      logger.error('Error deleting image:', error)
      throw error
    }
  },

  /**
   * Upload multiple property images in batch
   * @param {string} propertyId - Property Firestore document ID
   * @param {File[]} files - Array of image files to upload
   * @returns {Promise<string[]>} Array of download URLs for uploaded images
   * @throws {Error} On storage upload failure for any file
   * @example
   * const urls = await listingService.batchUploadImages('prop_222', [file1, file2])
   */
  async batchUploadImages(propertyId: string, files: File[]): Promise<string[]> {
    try {
      const urls: string[] = []

      for (const file of files) {
        const url = await this.uploadPropertyImage(propertyId, file)
        urls.push(url)
      }

      return urls
    } catch (error) {
      logger.error('Error batch uploading images:', error)
      throw error
    }
  }
}
