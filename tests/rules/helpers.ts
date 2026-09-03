import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
  type RulesTestContext
} from '@firebase/rules-unit-testing'
import {readFileSync} from 'node:fs'
import path from 'node:path'

// Идентификатор с приставкой demo- гарантирует, что SDK не пойдёт в настоящий
// Firebase даже при неверно выставленных переменных окружения.
const PROJECT_ID = 'demo-birklik-rules'

export const OWNER = 'owner-uid'
export const GUEST = 'guest-uid'
export const STRANGER = 'stranger-uid'
export const MODERATOR = 'moderator-uid'

let testEnv: RulesTestEnvironment | undefined

export async function getTestEnv(): Promise<RulesTestEnvironment> {
  if (testEnv) return testEnv
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080
    }
  })
  return testEnv
}

export function authed(env: RulesTestEnvironment, uid: string): RulesTestContext {
  return env.authenticatedContext(uid)
}

/** Модератор отличается заявкой в токене, а не документом в базе. */
export function moderator(env: RulesTestEnvironment): RulesTestContext {
  return env.authenticatedContext(MODERATOR, {moderator: true})
}

export function anon(env: RulesTestEnvironment): RulesTestContext {
  return env.unauthenticatedContext()
}

export const PROPERTY_ID = 'prop-1'

export function propertyDoc(overrides: Record<string, unknown> = {}) {
  return {
    ownerId: OWNER,
    title: 'Test',
    status: 'active',
    listingTier: 'standard',
    isFeatured: false,
    favorites: [],
    views: 0,
    ...overrides
  }
}

export function bookingDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    propertyId: PROPERTY_ID,
    userId: GUEST,
    ownerId: OWNER,
    userName: 'Guest',
    userEmail: 'guest@example.com',
    userPhone: '+994500000000',
    checkInDate: '2026-10-01',
    checkOutDate: '2026-10-05',
    nights: 4,
    totalPrice: 400,
    createdAt: '2026-09-01T00:00:00.000Z',
    status: 'pending',
    ...overrides
  }
}
