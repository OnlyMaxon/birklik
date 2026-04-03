export type PropertyType = 'villa' | 'apartment' | 'house' | 'cottage' | 'penthouse'

export type District = 'mardakan' | 'novkhani' | 'buzovna' | 'bilgah' | 'zagulba' | 'pirshagi' | 'shuvalan' | 'baku' | 'nabran' | 'gabala'

export type LocationCategory = 'rayon' | 'metro'

export type Amenity = 'pool' | 'parking' | 'wifi' | 'ac' | 'kitchen' | 'tv' | 'washer' | 'garden' | 'bbq' | 'security' | 'beach' | 'gym'

export interface LocalizedText {
  az: string
  en: string
  ru?: string
}

export interface PropertyPrice {
  daily: number
  weekly: number
  monthly: number
  currency: string
}

export interface PropertyOwner {
  name: string
  phone: string
  email: string
}

export type ListingTier = 'free' | 'standard' | 'premium'

export type ListingStatus = 'active' | 'pending'

export interface Property {
  id: string
  type: PropertyType
  district: District
  price: PropertyPrice
  rooms: number
  minGuests: number
  maxGuests: number
  area: number
  amenities: Amenity[]
  images: string[]
  coordinates: { lat: number; lng: number }
  title: LocalizedText
  description: LocalizedText
  address: LocalizedText
  owner: PropertyOwner
  rating?: number
  reviews?: number
  // Firebase specific fields
  ownerId?: string
  listingTier?: ListingTier
  status?: ListingStatus
  isFeatured?: boolean
  isActive?: boolean
  unavailableFrom?: string
  unavailableTo?: string
  extraFeatures?: string[]
  nearbyPlaces?: string[]
  locationCategory?: LocationCategory
  locationTags?: string[]
  createdAt?: string
  updatedAt?: string
  city?: string
}

export interface User {
  id: string
  name: string
  email: string
  phone: string
  avatar?: string
}

export interface FilterState {
  search: string
  minPrice: number | null
  maxPrice: number | null
  rooms: number | null
  type: PropertyType | ''
  district: District | ''
  hasPool: boolean | null
  extraFilters: string[]
  nearbyPlaces: string[]
  city: string
  locationCategory: LocationCategory
  locationTags: string[]
  checkIn: string
  checkOut: string
  minGuests: number | null
  maxGuests: number | string | null
}
