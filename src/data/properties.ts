import { Property, PropertyType, District, Amenity, UserListing } from '../types'

export const mockProperties: Property[] = []

export const propertyTypes: PropertyType[] = [
  'villa',
  'apartment',
  'house',
  'cottage',
  'penthouse'
]

export const districts: District[] = [
  'mardakan',
  'novkhani',
  'buzovna',
  'bilgah',
  'zagulba',
  'pirshagi',
  'shuvalan',
  'baku',
  'nabran',
  'gabala'
]

export const amenitiesList: Amenity[] = [
  'pool',
  'parking',
  'wifi',
  'ac',
  'kitchen',
  'tv',
  'washer',
  'garden',
  'bbq',
  'security',
  'beach',
  'gym'
]

// Mock user listings for dashboard
export const mockUserListings: UserListing[] = []

// Helper functions
export const getPropertyById = (id: string): Property | undefined => {
  return mockProperties.find(p => p.id === id)
}

export const filterProperties = (
  properties: Property[],
  filters: {
    search?: string
    type?: PropertyType | ''
    district?: District | ''
    minPrice?: number
    maxPrice?: number
    rooms?: number
    hasPool?: boolean | null
  }
): Property[] => {
  return properties.filter(property => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matchesTitle = Object.values(property.title).some(t => t.toLowerCase().includes(searchLower))
      const matchesAddress = Object.values(property.address).some(a => a.toLowerCase().includes(searchLower))
      if (!matchesTitle && !matchesAddress) return false
    }

    // Type filter
    if (filters.type && property.type !== filters.type) return false

    // District filter
    if (filters.district && property.district !== filters.district) return false

    // Price filter
    if (filters.minPrice && property.price.daily < filters.minPrice) return false
    if (filters.maxPrice && property.price.daily > filters.maxPrice) return false

    // Rooms filter
    if (filters.rooms && property.rooms !== filters.rooms) return false

    // Pool filter
    if (filters.hasPool === true && !property.amenities.includes('pool')) return false
    if (filters.hasPool === false && property.amenities.includes('pool')) return false

    return true
  })
}
