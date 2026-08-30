import 'server-only'
import {unstable_cache} from 'next/cache'
import {queryDocs} from '@/lib/firebase/firestore-rest'
import {normalizePropertyImageUrls} from '@/lib/images'
import {toListItem} from '@/lib/property-list'
import type {Property} from '@/types'

// Тот же потолок, что и в карте сайта: неограниченный запрос в Firestore
// оставлять не хочется, а до предела ещё далеко.
const MAX_PROPERTIES = 5000

/** Активные объявления одного региона, свежие сверху. */
export const getCityProperties = unstable_cache(
  async (cityValue: string): Promise<Property[]> => {
    const properties = await queryDocs<Omit<Property, 'id'>>('properties', {
      where: [
        ['status', '==', 'active'],
        ['city', '==', cityValue]
      ],
      limit: MAX_PROPERTIES
    })

    return properties
      .map(normalizePropertyImageUrls)
      .map(toListItem)
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  },
  ['city-properties'],
  {revalidate: 300, tags: ['properties']}
)

// Список заполненных регионов нужен ещё и футеру на каждой странице, поэтому
// живёт в общем модуле запросов, а не здесь.
export {getCitiesWithListings} from '@/app/queries'
