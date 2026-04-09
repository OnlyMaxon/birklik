import { DocumentSnapshot, QueryConstraint } from 'firebase/firestore'
import { PropertyType, District } from '../types'

/**
 * Pagination options for server-side filtering
 */
export interface PaginationOptions {
  pageSize?: number
  startAfter?: DocumentSnapshot | null
  sortBy?: 'newest' | 'oldest' | 'priceAsc' | 'priceDesc' | 'featured'
}

/**
 * Server-side pagination result with metadata
 */
export interface PaginationResult<T> {
  items: T[]
  cursor: DocumentSnapshot | null
  hasMore: boolean
  pageSize: number
  totalInPage: number
}

/**
 * Advanced filter constraints for efficient Firestore queries
 */
export interface AdvancedFilters {
  type?: PropertyType
  district?: District
  minPrice?: number
  maxPrice?: number
  minRooms?: number
  maxRooms?: number
  minGuests?: number
  maxGuests?: number
  amenities?: string[]
  status?: 'active' | 'pending'
  isFeatured?: boolean
  hasPhotos?: boolean
}

/**
 * Build Firestore query constraints from filter criteria
 * Optimized for composite indexes
 * 
 * @param {AdvancedFilters} filters - Filter criteria
 * @param {PaginationOptions} pagination - Pagination options
 * @returns {QueryConstraint[]} Array of Firestore constraints optimized for indexing
 * @example
 * const constraints = buildQueryConstraints({
 *   type: 'apartment',
 *   minPrice: 50,
 *   maxPrice: 500,
 *   status: 'active'
 * }, { pageSize: 12 })
 */
export const buildQueryConstraints = (
  filters: AdvancedFilters = {},
  pagination: PaginationOptions = {}
): QueryConstraint[] => {
  const constraints: QueryConstraint[] = []
  const { where, orderBy, limit, startAfter } = require('firebase/firestore')

  // Filter constraints - order matters for composite indexes
  if (filters.status) {
    constraints.push(where('status', '==', filters.status))
  } else {
    constraints.push(where('status', '==', 'active'))
  }

  if (filters.type) {
    constraints.push(where('type', '==', filters.type))
  }

  if (filters.district) {
    constraints.push(where('district', '==', filters.district))
  }

  if (filters.minPrice !== undefined) {
    constraints.push(where('price.daily', '>=', filters.minPrice))
  }

  if (filters.maxPrice !== undefined) {
    constraints.push(where('price.daily', '<=', filters.maxPrice))
  }

  if (filters.minRooms !== undefined) {
    constraints.push(where('rooms', '>=', filters.minRooms))
  }

  if (filters.isFeatured) {
    constraints.push(where('isFeatured', '==', true))
  }

  // Sorting - must come after where clauses
  // Premium listings always come first if still active (premiumExpiresAt > now)
  const sortBy = pagination.sortBy || 'featured'
  switch (sortBy) {
    case 'newest':
      constraints.push(orderBy('premiumExpiresAt', 'desc'))
      constraints.push(orderBy('createdAt', 'desc'))
      break
    case 'oldest':
      constraints.push(orderBy('premiumExpiresAt', 'desc'))
      constraints.push(orderBy('createdAt', 'asc'))
      break
    case 'priceAsc':
      constraints.push(orderBy('premiumExpiresAt', 'desc'))
      constraints.push(orderBy('price.daily', 'asc'))
      break
    case 'priceDesc':
      constraints.push(orderBy('premiumExpiresAt', 'desc'))
      constraints.push(orderBy('price.daily', 'desc'))
      break
    case 'featured':
      constraints.push(orderBy('premiumExpiresAt', 'desc'))
      constraints.push(orderBy('isFeatured', 'desc'))
      constraints.push(orderBy('createdAt', 'desc'))
      break
  }

  // Pagination
  const pageSize = pagination.pageSize || 12
  constraints.push(limit(pageSize + 1)) // +1 to check if hasMore

  if (pagination.startAfter) {
    constraints.push(startAfter(pagination.startAfter))
  }

  return constraints
}

/**
 * Calculate if there are more results beyond current page
 * @param {T[]} items - Current page items
 * @param {number} pageSize - Expected page size
 * @returns {boolean} True if there are more results
 */
export const calculateHasMore = <T>(items: T[], pageSize: number): boolean => {
  return items.length > pageSize
}

/**
 * Trim results to page size (removing the extra +1 used for hasMore check)
 * @param {T[]} items - Items from query (may have +1 for checking hasMore)
 * @param {number} pageSize - Expected page size
 * @returns {T[]} Trimmed items
 */
export const trimToPageSize = <T>(items: T[], pageSize: number): T[] => {
  return items.slice(0, pageSize)
}

/**
 * Format pagination result with all metadata
 * @param {T[]} items - Items from firestore query
 * @param {DocumentSnapshot | null} cursor - Last document for next cursor
 * @param {number} pageSize - Page size
 * @returns {PaginationResult<T>} Formatted result with metadata
 */
export const formatPaginationResult = <T>(
  items: T[],
  cursor: DocumentSnapshot | null,
  pageSize: number
): PaginationResult<T> => {
  const hasMore = calculateHasMore(items, pageSize)
  const trimmed = trimToPageSize(items, pageSize)
  const nextCursor = hasMore && items.length > pageSize ? cursor : null

  return {
    items: trimmed,
    cursor: nextCursor,
    hasMore,
    pageSize,
    totalInPage: trimmed.length
  }
}
