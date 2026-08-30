import 'server-only'
import {unstable_cache} from 'next/cache'
import {after} from 'next/server'
import {getDoc, queryDocs, updateDoc, increment, type QueryOptions} from '@/lib/firebase/firestore-rest'
import type {Property, Booking} from '@/types'
import {normalizePropertyImageUrls, toImageApiUrl} from '@/lib/images'

type PropertyMetadata = {title?: string; description?: string; image?: string}

// Владелец пишет описание в textarea, и переводы строк попадают в базу как
// есть. В мета-теге они выглядят обрывом посреди предложения, а в разметке
// Schema.org — лишним мусором. Схлопываем любые пробельные последовательности
// в один пробел; на самой странице объявления текст остаётся нетронутым.
const singleLine = (text: string): string => text.replace(/\s+/g, ' ').trim()

/** Заголовок и описание хранятся как `{az, en, ru}`; берём первый непустой. */
function localized(value: unknown): string | undefined {
  if (typeof value === 'string') return singleLine(value) || undefined
  if (!value || typeof value !== 'object') return undefined
  const translations = value as Record<string, unknown>
  for (const language of ['az', 'en', 'ru']) {
    const text = translations[language]
    if (typeof text === 'string' && text) return singleLine(text) || undefined
  }
  return undefined
}

// Читается авторизованным клиентом: на Firestore включён App Check, и прямой
// запрос к REST API без токена возвращает 403 — раньше метаданные молча
// оставались пустыми, и соцсети получали страницу без title и картинки.
export const getPropertyMetadata = unstable_cache(
  async (propertyId: string): Promise<PropertyMetadata | null> => {
    const property = await getDoc<{title?: unknown; description?: unknown; images?: unknown}>(
      'properties',
      propertyId
    )
    if (!property) return null

    const images = Array.isArray(property.images) ? property.images : []
    return {
      title: localized(property.title),
      description: localized(property.description),
      image: typeof images[0] === 'string' ? toImageApiUrl(images[0]) : undefined
    }
  },
  ['property-metadata'],
  {revalidate: 300, tags: ['properties']}
)

// unstable_cache is called per-invocation (not hoisted to module scope) so its `tags`
// can be computed per propertyId — that's what lets a single mutation's
// revalidateTag(`property:<id>`) invalidate exactly this property's cache entry.
export async function getProperty(propertyId: string): Promise<Property | null> {
  const property = await unstable_cache(
    async () => getDoc<Omit<Property, 'id'>>('properties', propertyId),
    ['property', propertyId],
    {revalidate: 30, tags: [`property:${propertyId}`, 'properties']}
  )()
  return property ? normalizePropertyImageUrls(property) : null
}

export async function getPropertyBookingsForAvailability(propertyId: string): Promise<Booking[]> {
  return queryDocs<Omit<Booking, 'id'>>('bookings', {where: [['propertyId', '==', propertyId]]})
}

export async function getSimilarProperties(property: Property): Promise<Property[]> {
  const where: QueryOptions['where'] = [['status', '==', 'active']]
  where.push(property.city ? ['city', '==', property.city] : ['type', '==', property.type])

  // Берём на одно больше десяти: текущий объект может оказаться в выборке и
  // будет отфильтрован.
  const properties = await queryDocs<Omit<Property, 'id'>>('properties', {where, limit: 11})
  return properties.map(normalizePropertyImageUrls).filter(p => p.id !== property.id).slice(0, 10)
}

export async function hasUserBookedProperty(userId: string, propertyId: string): Promise<boolean> {
  const bookings = await queryDocs('bookings', {
    where: [
      ['userId', '==', userId],
      ['propertyId', '==', propertyId],
      ['status', '==', 'approved']
    ],
    limit: 1
  })
  return bookings.length > 0
}

export async function getUserRatingForProperty(propertyId: string, userId: string): Promise<number | null> {
  const property = await getDoc<{ratings?: Record<string, number>}>('properties', propertyId)
  if (!property) return null
  const ratings = property.ratings || {}
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
  const user = await getDoc<{name?: string; email?: string; phone?: string; avatar?: string}>('users', userId)
  if (!user) return null
  return {id: userId, name: user.name || 'User', email: user.email || '', phone: user.phone || '', avatar: toImageApiUrl(user.avatar)}
}

// Не блокирует рендер страницы; потерянный инкремент при гонке — приемлемая
// плата за счётчик просмотров.
//
// after() обязателен: на Cloudflare Workers промис, который никто не дождался,
// отменяется сразу после отправки ответа, и запись просто не доходила до
// Firestore. after() отдаёт работу в waitUntil воркера — она доделывается
// после рендера, не задерживая ответ.
export function recordPropertyView(propertyId: string): void {
  after(async () => {
    await updateDoc('properties', propertyId, {views: increment(1)}).catch(() => {})
  })
}
