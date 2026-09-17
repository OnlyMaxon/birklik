import 'server-only'
import {unstable_cache} from 'next/cache'
import {queryDocs, DOCUMENT_ID, type QueryOptions} from '@/lib/firebase/firestore-rest'
import type {Property} from '@birklik/core/types'
import {normalizePropertyImageUrls} from '@/lib/images'
import {isOnDisplay, toListItem} from '@/lib/property-list'

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

  const properties = await queryDocs<Omit<Property, 'id'>>('properties', {where, limit: 100})
  // Отсев по дате поверх статуса: Firestore знает только `status`, а он меняется
  // раз в сутки ночным прогоном. См. isOnDisplay.
  return properties.filter(isOnDisplay).map(normalizePropertyImageUrls).map(toListItem)
}

export async function getPropertiesPage(
  filters: HomePropertiesFilters,
  cursor: PropertyCursor | null
): Promise<PropertiesPage> {
  const where: QueryOptions['where'] = [['status', '==', 'active']]
  if (filters.city) where.push(['city', '==', filters.city])

  const documents = await queryDocs<Omit<Property, 'id'>>('properties', {
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

  // ⚠️ Продолжение и курсор считаются по СЫРОЙ выдаче, до отсева по дате.
  //
  // Раньше `isOnDisplay` применялся первым, и лишний двадцать первый документ —
  // тот самый признак продолжения — мог отсеяться вместе с истёкшим тарифом.
  // Тогда 21 превращалось в 20, `20 > 20` давало ложь, курсор выходил пустым и
  // подгрузка не начиналась вовсе: из 73 объявлений главная показывала 25.
  // Ловушка тихая и появляется от данных, а не от правок — пока ни у кого не
  // кончался оплаченный срок, отсеивать было нечего и всё работало.
  //
  // Курсор тоже строится по сырому документу: продолжать надо с места, где
  // выборка реально оборвалась, иначе отсеянные документы были бы пройдены
  // повторно или, наоборот, перепрыгнуты.
  const hasMore = documents.length > PAGE_SIZE
  const consumed = documents.slice(0, PAGE_SIZE)
  const lastDocument = consumed[consumed.length - 1]
  // Курсор строится по createdAt, поэтому без него продолжать нечем — тогда
  // страница считается последней, а не отдаёт заведомо битый курсор.
  const nextCursor =
    hasMore && lastDocument?.createdAt ? {createdAt: lastDocument.createdAt, id: lastDocument.id} : null

  // Отсев уже не влияет на разбиение: страница просто отдаёт меньше карточек.
  const properties = consumed.filter(isOnDisplay).map(normalizePropertyImageUrls).map(toListItem)

  return {properties, cursor: nextCursor}
}

/**
 * Регионы, где есть хотя бы одно активное объявление, от крупных к мелким.
 *
 * Нужно всем, кто рисует ссылки на посадочные страницы регионов: справочник
 * городов куда шире реальной географии объявлений, и ссылка на пустой регион
 * вела бы в 404. Считается одним запросом, а не по одному на город.
 */
export const getCitiesWithListings = unstable_cache(
  async (): Promise<Array<{city: string; count: number}>> => {
    const properties = await queryDocs<{city?: string}>('properties', {
      where: [['status', '==', 'active']],
      select: ['city'],
      limit: 5000
    })

    const counts = new Map<string, number>()
    for (const property of properties) {
      if (!property.city) continue
      counts.set(property.city, (counts.get(property.city) ?? 0) + 1)
    }

    return [...counts]
      .map(([city, count]) => ({city, count}))
      .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city))
  },
  ['cities-with-listings'],
  {revalidate: 300, tags: ['properties']}
)

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
