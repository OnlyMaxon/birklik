import 'server-only'
import {unstable_cache} from 'next/cache'
import {queryDocs} from '@/lib/firebase/firestore-rest'
import {normalizePropertyImageUrls} from '@/lib/images'
import {isOnDisplay, toListItem} from '@/lib/property-list'
import {tierRank} from '@birklik/core/utils/premium-helper'
import type {Property} from '@birklik/core/types'

// Тот же потолок, что и в карте сайта: неограниченный запрос в Firestore
// оставлять не хочется, а до предела ещё далеко.
const MAX_PROPERTIES = 5000

/**
 * Активные объявления одного региона: сперва платные тарифы, внутри тарифа —
 * свежие сверху.
 *
 * Сортировки по тарифу здесь не было вовсе, только по дате. Получалось, что на
 * главной оплаченное место работает, а на странице региона — нет, хотя именно
 * туда ведёт длинный хвост поисковых запросов.
 */
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
      .filter(isOnDisplay)
      .map(normalizePropertyImageUrls)
      .map(toListItem)
      .sort((a, b) => tierRank(b) - tierRank(a) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  },
  ['city-properties'],
  {revalidate: 300, tags: ['properties']}
)

// Список заполненных регионов нужен ещё и футеру на каждой странице, поэтому
// живёт в общем модуле запросов, а не здесь.
export {getCitiesWithListings} from '@/app/queries'
