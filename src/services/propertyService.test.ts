import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Property } from '../types'

const firestoreMocks = vi.hoisted(() => ({
  addDocMock: vi.fn(),
  getDocsMock: vi.fn(),
  getDocMock: vi.fn(),
  updateDocMock: vi.fn(),
  deleteDocMock: vi.fn(),
  queryMock: vi.fn(),
  whereMock: vi.fn(),
  orderByMock: vi.fn(),
  limitMock: vi.fn(),
  startAfterMock: vi.fn()
}))

vi.mock('../config/firebase', () => ({
  db: {},
  storage: {}
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'properties-collection'),
  doc: vi.fn((_: unknown, __: string, id: string) => ({ id })),
  getDocs: firestoreMocks.getDocsMock,
  getDoc: firestoreMocks.getDocMock,
  addDoc: firestoreMocks.addDocMock,
  updateDoc: firestoreMocks.updateDocMock,
  deleteDoc: firestoreMocks.deleteDocMock,
  query: firestoreMocks.queryMock,
  where: firestoreMocks.whereMock,
  orderBy: firestoreMocks.orderByMock,
  limit: firestoreMocks.limitMock,
  startAfter: firestoreMocks.startAfterMock
}))

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  deleteObject: vi.fn()
}))

const fallbackMockProperties = vi.hoisted(() => ([
  {
    id: 'fallback-1',
    type: 'villa',
    district: 'mardakan',
    price: { daily: 200, weekly: 1200, monthly: 4800, currency: 'AZN' },
    rooms: 4,
    minGuests: 2,
    maxGuests: 6,
    area: 180,
    amenities: ['pool', 'wifi'],
    images: [],
    coordinates: { lat: 40.4, lng: 49.8 },
    title: { az: 'Fallback villa', en: 'Fallback villa' },
    description: { az: 'Description', en: 'Description' },
    address: { az: 'Mardakan', en: 'Mardakan' },
    owner: { name: 'Owner', phone: '+994', email: 'owner@test.com' },
    isActive: true
  }
] as Property[]))

vi.mock('../data', () => ({
  mockProperties: fallbackMockProperties
}))

import { createProperty, getProperties, updateProperty } from './propertyService'

const makeProperty = (overrides: Partial<Property> = {}): Property => ({
  id: 'p-1',
  type: 'villa',
  district: 'mardakan',
  price: { daily: 100, weekly: 600, monthly: 2400, currency: 'AZN' },
  rooms: 3,
  minGuests: 1,
  maxGuests: 4,
  area: 120,
  amenities: ['pool'],
  images: [],
  coordinates: { lat: 40.4093, lng: 49.8671 },
  title: { az: 'Villa', en: 'Villa' },
  description: { az: 'Test', en: 'Test' },
  address: { az: 'Baku', en: 'Baku' },
  owner: { name: 'Owner', phone: '+994000000', email: 'owner@test.com' },
  createdAt: '2026-03-25T00:00:00.000Z',
  updatedAt: '2026-03-25T00:00:00.000Z',
  ...overrides
})

describe('propertyService publication logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    firestoreMocks.whereMock.mockImplementation((...args: unknown[]) => ({ op: 'where', args }))
    firestoreMocks.orderByMock.mockImplementation((...args: unknown[]) => ({ op: 'orderBy', args }))
    firestoreMocks.limitMock.mockImplementation((...args: unknown[]) => ({ op: 'limit', args }))
    firestoreMocks.startAfterMock.mockImplementation((...args: unknown[]) => ({ op: 'startAfter', args }))
    firestoreMocks.queryMock.mockImplementation((...args: unknown[]) => ({ args }))
  })

  it('creates publication with timestamps and active state', async () => {
    firestoreMocks.addDocMock.mockResolvedValue({ id: 'created-1' })

    const payload = makeProperty({ id: 'temp-id' })
    const { id: _ignored, createdAt: _c, updatedAt: _u, ...createPayload } = payload

    const result = await createProperty(createPayload)

    expect(result?.id).toBe('created-1')
    expect(result?.isActive).toBe(true)
    expect(result?.createdAt).toBeTypeOf('string')
    expect(result?.updatedAt).toBeTypeOf('string')
    expect(firestoreMocks.addDocMock).toHaveBeenCalledTimes(1)
  })

  it('updates publication and stamps updatedAt', async () => {
    firestoreMocks.getDocMock.mockResolvedValue({ exists: () => true, data: () => makeProperty({ images: ['old.png'] }) })
    firestoreMocks.updateDocMock.mockResolvedValue(undefined)

    const ok = await updateProperty('p-1', { title: { az: 'Yeni', en: 'Updated' } })

    expect(ok).toBe(true)
    expect(firestoreMocks.updateDocMock).toHaveBeenCalledTimes(1)
    const updatePayload = firestoreMocks.updateDocMock.mock.calls[0][1] as Record<string, unknown>
    expect(updatePayload.updatedAt).toBeTypeOf('string')
  })

  it.skip('hides inactive occupied publications in list response', async () => {
    // TODO: Implement filtering by publication status
    const hiddenProperty = makeProperty({
      id: 'hidden',
      isActive: false,
      unavailableTo: '2999-01-01'
    })
    const visibleProperty = makeProperty({ id: 'visible', isActive: true })

    firestoreMocks.getDocsMock.mockResolvedValue({
      docs: [
        { id: hiddenProperty.id, data: () => hiddenProperty },
        { id: visibleProperty.id, data: () => visibleProperty }
      ]
    })

    const result = await getProperties()

    expect(result.properties.map((p) => p.id)).toEqual(['visible'])
  })

  it.skip('uses fallback publications when firestore returns empty', async () => {
    // TODO: Implement fallback publications mechanism
    firestoreMocks.getDocsMock.mockResolvedValue({ docs: [] })

    const result = await getProperties({ type: 'villa' })

    expect(result.properties.length).toBeGreaterThan(0)
    expect(result.properties[0].id).toBe('fallback-1')
  })
})
