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
  QueryConstraint
} from 'firebase/firestore'
import { db } from '../config/firebase'

/**
 * Base Firestore Service - Provides reusable CRUD operations for any Firestore collection
 * Reduces code duplication across domain-specific services (propertyService, bookingService, etc)
 *
 * @template T - The type of document stored in the collection
 * @example
 * interface User { id: string; name: string; email: string }
 * const userService = new BaseFirestoreService<User>('users')
 * const user = await userService.getById('user_123')
 * const created = await userService.create({ name: 'John', email: 'john@example.com' })
 */
export class BaseFirestoreService<T extends Record<string, any>> {
  /**
   * Create a new BaseFirestoreService instance
   * @param {string} collectionName - Name of the Firestore collection
   * @example
   * const bookingService = new BaseFirestoreService<Booking>('bookings')
   */
  constructor(private collectionName: string) {}

  /**
   * Retrieve a single document by ID
   * @param {string} id - Document identifier
   * @returns {Promise<T | null>} Document data or null if not found
   * @throws {Error} On Firestore query failure
   * @example
   * const property = await propertyService.getById('prop_123')
   */
  async getById(id: string): Promise<T | null> {
    try {
      const docRef = doc(db, this.collectionName, id)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as unknown as T
      }
      return null
    } catch (error) {
      console.error(`Error getting ${this.collectionName}:`, error)
      throw error
    }
  }

  /**
   * Retrieve multiple documents matching query constraints
   * @param {QueryConstraint[]} constraints - Firestore query constraints (where, orderBy, limit, etc)
   * @returns {Promise<T[]>} Array of matching documents
   * @throws {Error} On Firestore query failure
   * @example
   * const active = await bookingService.query([
   *   where('status', '==', 'active'),
   *   orderBy('createdAt', 'desc'),
   *   limit(10)
   * ])
   */
  async query(...constraints: QueryConstraint[]): Promise<T[]> {
    try {
      const q = query(collection(db, this.collectionName), ...constraints)
      const snapshot = await getDocs(q)

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as unknown as T[]
    } catch (error) {
      console.error(`Error querying ${this.collectionName}:`, error)
      throw error
    }
  }

  /**
   * Retrieve all documents from the collection
   * @returns {Promise<T[]>} All documents in collection
   * @throws {Error} On Firestore query failure
   * @example
   * const allProperties = await propertyService.getAll()
   */
  async getAll(): Promise<T[]> {
    try {
      const snapshot = await getDocs(collection(db, this.collectionName))
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as unknown as T[]
    } catch (error) {
      console.error(`Error getting all ${this.collectionName}:`, error)
      throw error
    }
  }

  /**
   * Retrieve documents where a field matches a value
   * @param {string} field - Field name in document
   * @param {any} value - Value to match
   * @returns {Promise<T[]>} Array of matching documents
   * @throws {Error} On Firestore query failure
   * @example
   * const userProperties = await propertyService.findBy('ownerId', 'user_123')
   */
  async findBy(field: string, value: any): Promise<T[]> {
    try {
      const q = query(collection(db, this.collectionName), where(field, '==', value))
      const snapshot = await getDocs(q)

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as unknown as T[]
    } catch (error) {
      console.error(`Error finding ${this.collectionName} by ${field}:`, error)
      throw error
    }
  }

  /**
   * Create a new document with auto-generated ID
   * @param {Omit<T, 'id'>} data - Document data (without id)
   * @returns {Promise<T>} Created document with generated id
   * @throws {Error} On Firestore write failure
   * @example
   * const newBooking = await bookingService.create({
   *   propertyId: 'prop_123',
   *   userId: 'user_456',
   *   startDate: '2024-04-01'
   * })
   */
  async create(data: Omit<T, 'id'>): Promise<T> {
    try {
      const docRef = await addDoc(collection(db, this.collectionName), data)
      return { id: docRef.id, ...data } as unknown as T
    } catch (error) {
      console.error(`Error creating ${this.collectionName}:`, error)
      throw error
    }
  }

  /**
   * Create or update a document with specific ID
   * @param {string} id - Document identifier
   * @param {Partial<T>} data - Document data to set/merge
   * @returns {Promise<T>} Updated document
   * @throws {Error} On Firestore write failure
   * @example
   * const updated = await propertyService.set('prop_123', { price: 150 })
   */
  async set(id: string, data: Partial<T>): Promise<T> {
    try {
      const docRef = doc(db, this.collectionName, id)
      await updateDoc(docRef, data as any)
      const updated = await this.getById(id)
      return updated || ({ id, ...data } as unknown as T)
    } catch (error) {
      console.error(`Error setting ${this.collectionName}:`, error)
      throw error
    }
  }

  /**
   * Update specific fields of an existing document
   * @param {string} id - Document identifier
   * @param {Partial<T>} updates - Fields to update (partial object)
   * @returns {Promise<boolean>} True on success
   * @throws {Error} On Firestore update failure
   * @example
   * await propertyService.update('prop_789', { price: 200, views: 42 })
   */
  async update(id: string, updates: Partial<T>): Promise<boolean> {
    try {
      const docRef = doc(db, this.collectionName, id)
      await updateDoc(docRef, updates as any)
      return true
    } catch (error) {
      console.error(`Error updating ${this.collectionName}:`, error)
      throw error
    }
  }

  /**
   * Delete a document by ID
   * @param {string} id - Document identifier
   * @returns {Promise<boolean>} True on success
   * @throws {Error} On Firestore delete failure
   * @example
   * await bookingService.delete('booking_999')
   */
  async delete(id: string): Promise<boolean> {
    try {
      const docRef = doc(db, this.collectionName, id)
      await deleteDoc(docRef)
      return true
    } catch (error) {
      console.error(`Error deleting ${this.collectionName}:`, error)
      throw error
    }
  }

  /**
   * Batch create multiple documents
   * @param {Omit<T, 'id'>[]} items - Array of documents to create
   * @returns {Promise<T[]>} Array of created documents with generated IDs
   * @throws {Error} If any document creation fails
   * @example
   * const bookings = await bookingService.batchCreate([
   *   { propertyId: 'prop_1', userId: 'user_1' },
   *   { propertyId: 'prop_2', userId: 'user_2' }
   * ])
   */
  async batchCreate(items: Omit<T, 'id'>[]): Promise<T[]> {
    try {
      const created: T[] = []
      for (const item of items) {
        const result = await this.create(item)
        created.push(result)
      }
      return created
    } catch (error) {
      console.error(`Error batch creating ${this.collectionName}:`, error)
      throw error
    }
  }

  /**
   * Get count of documents matching optional criteria
   * @param {QueryConstraint[]} [constraints] - Optional query constraints
   * @returns {Promise<number>} Count of matching documents
   * @throws {Error} On Firestore query failure
   * @example
   * const activeCount = await propertyService.count([
   *   where('status', '==', 'active')
   * ])
   */
  async count(...constraints: QueryConstraint[]): Promise<number> {
    try {
      const q = query(collection(db, this.collectionName), ...constraints)
      const snapshot = await getDocs(q)
      return snapshot.docs.length
    } catch (error) {
      console.error(`Error counting ${this.collectionName}:`, error)
      throw error
    }
  }

  /**
   * Batch delete multiple documents by IDs
   * @param {string[]} ids - Array of document IDs to delete
   * @returns {Promise<boolean>} True if all deletions succeeded
   * @throws {Error} If any deletion fails
   * @example
   * await propertyService.batchDelete(['prop_1', 'prop_2', 'prop_3'])
   */
  async batchDelete(ids: string[]): Promise<boolean> {
    try {
      for (const id of ids) {
        await this.delete(id)
      }
      return true
    } catch (error) {
      console.error(`Error batch deleting ${this.collectionName}:`, error)
      throw error
    }
  }

  /**
   * Check if a document exists
   * @param {string} id - Document identifier
   * @returns {Promise<boolean>} True if document exists
   * @throws {Error} On Firestore query failure
   * @example
   * const exists = await propertyService.exists('prop_123')
   */
  async exists(id: string): Promise<boolean> {
    try {
      const docRef = doc(db, this.collectionName, id)
      const docSnap = await getDoc(docRef)
      return docSnap.exists()
    } catch (error) {
      console.error(`Error checking existence in ${this.collectionName}:`, error)
      throw error
    }
  }
}

// Export factory function for convenience
export const createFirestoreService = <T extends Record<string, any>>(
  collectionName: string
): BaseFirestoreService<T> => {
  return new BaseFirestoreService<T>(collectionName)
}
