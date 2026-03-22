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
import { db, storage } from '../config/firebase'
import { Property, PropertyType, Language } from '../types'
import { mockProperties } from '../data'

const COLLECTION_NAME = 'properties'
const PAGE_SIZE = 12

const getTodayISO = (): string => new Date().toISOString().split('T')[0]

const isOccupationExpired = (property: Property): boolean => {
  if (!property.unavailableTo) return false
  return property.unavailableTo < getTodayISO()
}

const isHiddenByAvailability = (property: Property): boolean => {
  if (property.isActive !== false) return false
  return !isOccupationExpired(property)
}

export interface PropertyFilters {
  type?: PropertyType | 'all'
  district?: string
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

// Get all properties with optional filters and pagination
export const getProperties = async (
  filters?: PropertyFilters,
  lastDoc?: DocumentSnapshot
): Promise<{ properties: Property[]; lastDoc: DocumentSnapshot | null }> => {
  try {
    const constraints: QueryConstraint[] = []

    // Add filters
    if (filters?.type && filters.type !== 'all') {
      constraints.push(where('type', '==', filters.type))
    }
    if (filters?.district) {
      constraints.push(where('district', '==', filters.district))
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

    // Add ordering and pagination
    constraints.push(orderBy('createdAt', 'desc'))
    constraints.push(limit(PAGE_SIZE))

    if (lastDoc) {
      constraints.push(startAfter(lastDoc))
    }

    const q = query(collection(db, COLLECTION_NAME), ...constraints)
    const snapshot = await getDocs(q)

    const properties = snapshot.docs
      .map(mapDocToProperty)
      .filter(property => {
        if (isHiddenByAvailability(property)) return false
        if (filters?.maxRooms && property.rooms > filters.maxRooms) return false
        return matchesSearch(property, filters?.search)
      })

    if (properties.length === 0) {
      const fallbackProperties = mockProperties.filter(property => {
        if (isHiddenByAvailability(property)) return false
        if (filters?.type && filters.type !== 'all' && property.type !== filters.type) return false
        if (filters?.district && property.district !== filters.district) return false
        if (filters?.minPrice && property.price.daily < filters.minPrice) return false
        if (filters?.maxPrice && property.price.daily > filters.maxPrice) return false
        if (filters?.minRooms && property.rooms < filters.minRooms) return false
        if (filters?.maxRooms && property.rooms > filters.maxRooms) return false
        return matchesSearch(property, filters?.search)
      })

      return { properties: fallbackProperties, lastDoc: null }
    }

    const newLastDoc = snapshot.docs.length > 0 
      ? snapshot.docs[snapshot.docs.length - 1] 
      : null

    return { properties, lastDoc: newLastDoc }
  } catch (error) {
    console.error('Error getting properties:', error)
    const fallbackProperties = mockProperties.filter(property => {
      if (isHiddenByAvailability(property)) return false
      if (filters?.type && filters.type !== 'all' && property.type !== filters.type) return false
      if (filters?.district && property.district !== filters.district) return false
      if (filters?.minPrice && property.price.daily < filters.minPrice) return false
      if (filters?.maxPrice && property.price.daily > filters.maxPrice) return false
      if (filters?.minRooms && property.rooms < filters.minRooms) return false
      if (filters?.maxRooms && property.rooms > filters.maxRooms) return false
      return matchesSearch(property, filters?.search)
    })

    return { properties: fallbackProperties, lastDoc: null }
  }
}

// Get a single property by ID
export const getPropertyById = async (id: string): Promise<Property | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      return mapDocToProperty(docSnap)
    }
    return null
  } catch (error) {
    console.error('Error getting property:', error)
    return null
  }
}

// Get properties by owner ID
export const getPropertiesByOwner = async (ownerId: string): Promise<Property[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc')
    )
    const snapshot = await getDocs(q)

    return snapshot.docs
      .map(mapDocToProperty)
      .filter(property => !isHiddenByAvailability(property))
  } catch (error) {
    console.error('Error getting user properties:', error)
    return []
  }
}

// Create a new property
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

    const propertyData: Omit<Property, 'id'> = {
      ...property,
      images: imageUrls.length > 0 ? imageUrls : property.images,
      createdAt: now,
      updatedAt: now,
      isActive: true
    }

    const docRef = await addDoc(collection(db, COLLECTION_NAME), propertyData)
    return { id: docRef.id, ...propertyData } as Property
  } catch (error) {
    console.error('Error creating property:', error)
    return null
  }
}

// Update a property
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

    const updateData = {
      ...updates,
      ...(newImageUrls.length > 0 && { 
        images: [...(updates.images || currentData?.images || []), ...newImageUrls]
      }),
      updatedAt: new Date().toISOString()
    }

    await updateDoc(docRef, updateData)
    return true
  } catch (error) {
    console.error('Error updating property:', error)
    return false
  }
}

// Delete a property
export const deleteProperty = async (id: string): Promise<boolean> => {
  try {
    // Get property to delete images
    const property = await getPropertyById(id)
    if (property?.images) {
      await deletePropertyImages(property.images)
    }

    await deleteDoc(doc(db, COLLECTION_NAME, id))
    return true
  } catch (error) {
    console.error('Error deleting property:', error)
    return false
  }
}

// Upload property images to Firebase Storage
export const uploadPropertyImages = async (files: File[]): Promise<string[]> => {
  const urls: string[] = []

  for (const file of files) {
    try {
      const timestamp = Date.now()
      const fileName = `properties/${timestamp}_${file.name}`
      const storageRef = ref(storage, fileName)

      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      urls.push(url)
    } catch (error) {
      console.error('Error uploading image:', error)
    }
  }

  return urls
}

// Delete property images from Firebase Storage
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
      console.error('Error deleting image:', error)
    }
  }
}

// Get featured properties (for homepage)
export const getFeaturedProperties = async (count: number = 6): Promise<Property[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('isFeatured', '==', true),
      orderBy('createdAt', 'desc'),
      limit(count)
    )
    const snapshot = await getDocs(q)

    return snapshot.docs.map(mapDocToProperty)
  } catch (error) {
    console.error('Error getting featured properties:', error)
    return []
  }
}

// Search properties by title or description
export const searchProperties = async (searchTerm: string, lang: Language = 'az'): Promise<Property[]> => {
  try {
    // Note: Firestore doesn't support full-text search natively
    // For production, consider using Algolia or Elasticsearch
    // This is a simple implementation that gets all and filters client-side
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('createdAt', 'desc'),
      limit(100)
    )
    const snapshot = await getDocs(q)

    const searchLower = searchTerm.toLowerCase()
    const properties = snapshot.docs.map(mapDocToProperty)

    return properties.filter((property) => !isHiddenByAvailability(property) && matchesSearch(property, searchLower, lang))
  } catch (error) {
    console.error('Error searching properties:', error)
    return []
  }
}
