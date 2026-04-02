import { describe, expect, it } from 'vitest'
import { filterProperties } from './properties'
import type { Property } from '../types'

const baseProperty: Property = {
  id: 'base',
  type: 'villa',
  district: 'mardakan',
  price: { daily: 250, weekly: 1500, monthly: 6000, currency: 'AZN' },
  rooms: 5,
  guests: 8,
  area: 240,
  amenities: ['pool', 'parking', 'wifi', 'ac'],
  images: ['img.png'],
  coordinates: { lat: 40.4, lng: 49.8 },
  title: { az: 'Villa', en: 'Villa' },
  description: { az: 'Description', en: 'Description' },
  address: { az: 'Baku', en: 'Baku' },
  owner: { name: 'Owner', phone: '+994', email: 'owner@test.com' },
  city: 'Baku',
  extraFeatures: ['sauna', 'garage'],
  nearbyPlaces: ['sea', 'beach'],
  locationCategory: 'rayon',
  locationTags: ['port_baku']
}

describe('filterProperties publication filtering', () => {
  it('matches city exactly (case-insensitive)', () => {
    const result = filterProperties([baseProperty], { city: 'baku' })
    expect(result).toHaveLength(1)
  })

  it('filters by extra features from advanced section', () => {
    const result = filterProperties([baseProperty], { extraFilters: ['sauna', 'garage'] })
    expect(result).toHaveLength(1)
  })

  it('filters by nearby places from Yaxinda section', () => {
    const result = filterProperties([baseProperty], { nearbyPlaces: ['beach'] })
    expect(result).toHaveLength(1)
  })

  it('filters by location category and selected location tags', () => {
    const result = filterProperties([baseProperty], {
      locationCategory: 'rayon',
      locationTags: ['port_baku']
    })

    expect(result).toHaveLength(1)
  })

  it('does not match when required location tag is absent', () => {
    const result = filterProperties([baseProperty], {
      locationCategory: 'metro',
      locationTags: ['28_may']
    })

    expect(result).toHaveLength(0)
  })
})
