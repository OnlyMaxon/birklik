import 'server-only'
import {unstable_cache} from 'next/cache'
import {queryDocs, DOCUMENT_ID, type QueryOptions} from '@/lib/firebase/firestore-rest'
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

async function fetchPremiumProperties(filters: HomePropertiesFilters): Promise<Property[]> {
  const where: QueryOptions['where'] = [
    ['status', '==', 'active'],
    ['listingTier', 'in', ['vip', 'premium']]
  ]
  if (filters.city) where.push(['city', '==', filters.city])

  return queryDocs<Omit<Property, 'id'>>('properties', {where, limit: 100})
}

export async function getPropertiesPage(
  filters: HomePropertiesFilters,
  cursor: PropertyCursor | null
): Promise<PropertiesPage> {
  const where: QueryOptions['where'] = [['status', '==', 'active']]
  if (filters.city) where.push(['city', '==', filters.city])

  const properties = await queryDocs<Omit<Property, 'id'>>('properties', {
    where,
    // Сортировка по идентификатору вторым ключом делает курсор однозначным,
    // когда несколько объявлений созданы в одну и ту же миллисекунду.
    orderBy: [
      ['createdAt', 'desc'],
      [DOCUMENT_ID, 'desc']
    ],
    ...(cursor ? {startAfter: [cursor.createdAt, cursor.id]} : {}),
    // Берём на один больше страницы, чтобы понять, есть ли продолжение.
    limit: PAGE_SIZE + 1
  })

  const hasMore = properties.length > PAGE_SIZE
  const page = properties.slice(0, PAGE_SIZE)
  const lastProperty = page[page.length - 1]
  // Курсор строится по createdAt, поэтому без него продолжать нечем — тогда
  // страница считается последней, а не отдаёт заведомо битый курсор.
  const nextCursor =
    hasMore && lastProperty?.createdAt ? {createdAt: lastProperty.createdAt, id: lastProperty.id} : null

  return {properties: page, cursor: nextCursor}
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
