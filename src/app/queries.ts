import 'server-only'
import {unstable_cache} from 'next/cache'
import {FieldPath} from 'firebase-admin/firestore'
import {adminDb} from '@/lib/firebase/admin'
import type {Property} from '@/types'

const PAGE_SIZE = 20

export interface PropertyCursor {
  createdAt: string
  id: string
}

export interface HomePropertiesFilters {
  city?: string
}

export interface PropertiesPage {
  properties: Property[]
  cursor: PropertyCursor | null
}

export interface HomeProperties {
  premium: Property[]
  standard: PropertiesPage
}

function toProperty(doc: FirebaseFirestore.QueryDocumentSnapshot): Property {
  return {id: doc.id, ...(doc.data() as Omit<Property, 'id'>)}
}

async function fetchPremiumProperties(filters: HomePropertiesFilters): Promise<Property[]> {
  let query = adminDb
    .collection('properties')
    .where('status', '==', 'active')
    .where('listingTier', 'in', ['vip', 'premium'])
    .limit(100) as FirebaseFirestore.Query

  if (filters.city) query = query.where('city', '==', filters.city)

  const snapshot = await query.get()
  return snapshot.docs.map(toProperty)
}

export async function getPropertiesPage(
  filters: HomePropertiesFilters,
  cursor: PropertyCursor | null
): Promise<PropertiesPage> {
  let query = adminDb
    .collection('properties')
    .where('status', '==', 'active')
    .orderBy('createdAt', 'desc')
    .orderBy(FieldPath.documentId(), 'desc')
    .limit(PAGE_SIZE + 1) as FirebaseFirestore.Query

  if (filters.city) query = query.where('city', '==', filters.city)
  if (cursor) query = query.startAfter(cursor.createdAt, cursor.id)

  const snapshot = await query.get()
  const hasMore = snapshot.docs.length > PAGE_SIZE
  const docs = snapshot.docs.slice(0, PAGE_SIZE)
  const properties = docs.map(toProperty)
  const lastDoc = docs[docs.length - 1]
  const nextCursor = hasMore && lastDoc ? {createdAt: lastDoc.get('createdAt') as string, id: lastDoc.id} : null

  return {properties, cursor: nextCursor}
}

// Cached for the common case (no user-specific filters beyond city) — short revalidate
// window since new/changed listings should show up reasonably quickly on the homepage.
export const getHomeProperties = unstable_cache(
  async (filters: HomePropertiesFilters = {}): Promise<HomeProperties> => {
    const [premium, standard] = await Promise.all([
      fetchPremiumProperties(filters),
      getPropertiesPage(filters, null)
    ])
    const premiumIds = new Set(premium.map(p => p.id))
    return {
      premium,
      standard: {
        properties: standard.properties.filter(p => !premiumIds.has(p.id)),
        cursor: standard.cursor
      }
    }
  },
  ['home-properties'],
  {revalidate: 60, tags: ['properties']}
)
