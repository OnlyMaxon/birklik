import type {Amenity, ListingTier, LocationCategory, PropertyType} from '@birklik/core/types'

export type DashboardTab = 'listings' | 'add' | 'favorites' | 'bookings' | 'notifications' | 'profile'

export type PaymentNotification = 'success' | 'failed' | 'error' | null

export const DEFAULT_COORDINATES = {lat: 40.4093, lng: 49.8671}

export interface ListingFormState {
  title: string
  description: string
  listingTier: ListingTier
  tierPlanDuration: '14days' | '30days'
  type: PropertyType | ''
  district: string
  address: string
  price: string
  rooms: string
  minGuests: string
  maxGuests: string
  area: string
  amenities: Amenity[]
  extraFeatures: string[]
  nearbyPlaces: string[]
  locationCategory: LocationCategory
  locationTags: string[]
  city: string
  contactEmail: string
  contactPhone: string
}
