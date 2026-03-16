export type PropertyType = 'villa' | 'apartment' | 'house' | 'cottage' | 'penthouse'

export type District = 'mardakan' | 'novkhani' | 'buzovna' | 'bilgah' | 'zagulba' | 'pirshagi' | 'shuvalan' | 'baku' | 'nabran' | 'gabala'

export type Amenity = 'pool' | 'parking' | 'wifi' | 'ac' | 'kitchen' | 'tv' | 'washer' | 'garden' | 'bbq' | 'security' | 'beach' | 'gym'

export interface LocalizedText {
  az: string
  ru: string
  en: string
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

export interface Property {
  id: string
  type: PropertyType
  district: District
  price: PropertyPrice
  rooms: number
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
  isFeatured?: boolean
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
  city?: string
}

export interface UserListing {
  id: string
  propertyId: string
  status: 'active' | 'pending'
  views: number
  inquiries: number
  createdAt: string
  updatedAt: string
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
}
