import 'server-only'
import {unstable_cache} from 'next/cache'
import {FieldValue} from 'firebase-admin/firestore'
import {adminDb} from '@/lib/firebase/admin'
import type {Property, Booking} from '@/types'

type PropertyMetadata = {title?: string; description?: string; image?: string}

function stringValue(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const field = value as {stringValue?: string; mapValue?: {fields?: Record<string, unknown>}; arrayValue?: {values?: unknown[]}}
  if (field.stringValue) return field.stringValue
  const localized = field.mapValue?.fields
  if (localized) return stringValue(localized.az) ?? stringValue(localized.en) ?? stringValue(localized.ru)
  return field.arrayValue?.values?.map(stringValue).find(Boolean)
}

export const getPropertyMetadata = unstable_cache(async (propertyId: string): Promise<PropertyMetadata | null> => {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  if (!projectId) return null
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/properties/${encodeURIComponent(propertyId)}`,
    {next: {revalidate: 300, tags: [`property:${propertyId}`]}}
  )
  if (!response.ok) return null
  const document = await response.json() as {fields?: Record<string, unknown>}
  const fields = document.fields ?? {}
  return {
    title: stringValue(fields.title),
    description: stringValue(fields.description),
    image: stringValue(fields.images)
  }
}, ['property-metadata'], {revalidate: 300, tags: ['properties']})

function toProperty(doc: FirebaseFirestore.DocumentSnapshot): Property {
  return {id: doc.id, ...(doc.data() as Omit<Property, 'id'>)}
}

// unstable_cache is called per-invocation (not hoisted to module scope) so its `tags`
// can be computed per propertyId — that's what lets a single mutation's
// revalidateTag(`property:<id>`) invalidate exactly this property's cache entry.
export async function getProperty(propertyId: string): Promise<Property | null> {
  return unstable_cache(
    async () => {
      const snapshot = await adminDb.collection('properties').doc(propertyId).get()
      return snapshot.exists ? toProperty(snapshot) : null
    },
    ['property', propertyId],
    {revalidate: 30, tags: [`property:${propertyId}`, 'properties']}
  )()
}

export async function getPropertyBookingsForAvailability(propertyId: string): Promise<Booking[]> {
  const snapshot = await adminDb.collection('bookings').where('propertyId', '==', propertyId).get()
  return snapshot.docs.map(doc => ({id: doc.id, ...(doc.data() as Omit<Booking, 'id'>)}))
}

export async function getSimilarProperties(property: Property): Promise<Property[]> {
  let query = adminDb.collection('properties').where('status', '==', 'active').limit(11) as FirebaseFirestore.Query

  query = property.city ? query.where('city', '==', property.city) : query.where('type', '==', property.type)

  const snapshot = await query.get()
  return snapshot.docs
    .map(toProperty)
    .filter(p => p.id !== property.id)
    .slice(0, 10)
}

export async function hasUserBookedProperty(userId: string, propertyId: string): Promise<boolean> {
  const snapshot = await adminDb
    .collection('bookings')
    .where('userId', '==', userId)
    .where('propertyId', '==', propertyId)
    .where('status', '==', 'approved')
    .limit(1)
    .get()
  return !snapshot.empty
}

export async function getUserRatingForProperty(propertyId: string, userId: string): Promise<number | null> {
  const snapshot = await adminDb.collection('properties').doc(propertyId).get()
  if (!snapshot.exists) return null
  const ratings = (snapshot.data()?.ratings as Record<string, number>) || {}
  return typeof ratings[userId] === 'number' ? ratings[userId] : null
}

export interface CurrentUserProfile {
  id: string
  name: string
  email: string
  phone: string
  avatar?: string
}

export async function getUserProfile(userId: string): Promise<CurrentUserProfile | null> {
  const snapshot = await adminDb.collection('users').doc(userId).get()
  if (!snapshot.exists) return null
  const data = snapshot.data() as {name?: string; email?: string; phone?: string; avatar?: string}
  return {id: userId, name: data.name || 'User', email: data.email || '', phone: data.phone || '', avatar: data.avatar}
}

// Fire-and-forget — doesn't block the page render, and a lost increment under a race
// is an acceptable tradeoff for a view counter.
export function recordPropertyView(propertyId: string): void {
  adminDb
    .collection('properties')
    .doc(propertyId)
    .update({views: FieldValue.increment(1)})
    .catch(() => {})
}
