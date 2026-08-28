import type {MetadataRoute} from 'next'
import {queryDocs} from '@/lib/firebase/firestore-rest'
import {cityFromSlug, cityLandingPath} from '@/lib/city-landing'

const SITE_URL = 'https://birklik.az'

// Карта строится по запросу, а не на сборке. С revalidate она пререндерилась
// во время build, а scripts/cf-build.mjs на это время убирает env-файл с ключом
// сервис-аккаунта — запрос падал, и в артефакт запекался список без единого
// объявления. Поисковики ходят за картой редко, генерировать её на лету дёшево.
export const dynamic = 'force-dynamic'

// Потолок на случай роста базы. У поисковиков предел 50 000 адресов на файл,
// до него далеко, но неограниченный запрос в Firestore лучше не оставлять.
const MAX_PROPERTIES = 5000

// lastModified у статических страниц — фиксированная дата их последней правки,
// а НЕ момент генерации карты. Раньше здесь стоял `now`, и все шесть страниц на
// каждый запрос сообщали «изменено только что», причём с точностью до
// миллисекунды. Google от такого перестаёт доверять lastmod по всей карте
// целиком — включая объявления, где дата честная. Меняя текст страницы, надо
// поправить и дату здесь.
const STATIC_PAGES: Array<{
  path: string
  lastModified: string
  changeFrequency: 'daily' | 'monthly' | 'yearly'
  priority: number
}> = [
  // У главной даты нет: её ставим по самому свежему объявлению — она и правда
  // меняется тогда, когда меняется выдача.
  {path: '/', lastModified: '', changeFrequency: 'daily', priority: 1},
  {path: '/about', lastModified: '2026-08-03', changeFrequency: 'monthly', priority: 0.5},
  {path: '/contact', lastModified: '2026-08-03', changeFrequency: 'monthly', priority: 0.5},
  {path: '/terms', lastModified: '2026-08-03', changeFrequency: 'yearly', priority: 0.3},
  {path: '/privacy', lastModified: '2026-08-03', changeFrequency: 'yearly', priority: 0.3},
  {path: '/user-agreement', lastModified: '2026-08-03', changeFrequency: 'yearly', priority: 0.3}
]

type SitemapProperty = {updatedAt?: string; createdAt?: string; city?: string}

// Дата объявления: когда правили, иначе когда создали. Отсутствие обеих —
// повод не выдумывать дату, а не ставить сегодняшнюю.
const propertyDate = (property: SitemapProperty): Date | undefined => {
  const raw = property.updatedAt || property.createdAt
  if (!raw) return undefined
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const buildStatic = (homeDate: Date | undefined): MetadataRoute.Sitemap =>
    STATIC_PAGES.map(page => ({
      url: `${SITE_URL}${page.path}`,
      lastModified: page.lastModified ? new Date(page.lastModified) : homeDate,
      changeFrequency: page.changeFrequency,
      priority: page.priority
    }))

  let properties: Array<SitemapProperty & {id: string}> = []
  try {
    properties = await queryDocs<SitemapProperty>('properties', {
      // Только опубликованные: черновики, скрытые и ждущие модерации в выдаче
      // не нужны, а страницы у них всё равно закрыты.
      where: [['status', '==', 'active']],
      select: ['updatedAt', 'createdAt', 'city'],
      limit: MAX_PROPERTIES
    })
  } catch (error) {
    // Firestore недоступен — отдаём хотя бы статические страницы, пустая карта
    // сайта хуже неполной. Но молчать нельзя: именно проглоченная ошибка
    // однажды скрыла, что карта собирается без объявлений.
    console.error('[sitemap] не удалось получить объявления:', error)
    return buildStatic(undefined)
  }

  const propertyEntries: MetadataRoute.Sitemap = properties.map(property => ({
    url: `${SITE_URL}/property/${property.id}`,
    lastModified: propertyDate(property),
    changeFrequency: 'weekly',
    priority: 0.8
  }))

  // Главная меняется ровно тогда, когда появляется или правится объявление.
  const newestProperty = properties
    .map(propertyDate)
    .filter((date): date is Date => date !== undefined)
    .reduce<Date | undefined>((newest, date) => (!newest || date > newest ? date : newest), undefined)

  const staticEntries = buildStatic(newestProperty)

  // Посадочные страницы регионов — только те, где объявления есть: страница
  // пустого региона отдаёт 404, и в карте сайта ей делать нечего.
  const cityCounts = new Map<string, number>()
  for (const property of properties) {
    if (property.city) cityCounts.set(property.city, (cityCounts.get(property.city) ?? 0) + 1)
  }

  const cityEntries: MetadataRoute.Sitemap = [...cityCounts.keys()]
    .filter(city => cityFromSlug(city.toLowerCase()) !== undefined)
    .map(city => ({
      url: `${SITE_URL}${cityLandingPath(city)}`,
      lastModified: newestProperty,
      changeFrequency: 'daily' as const,
      priority: 0.7
    }))

  // Страницы входа, регистрации и личного кабинета намеренно не включены:
  // индексировать их незачем, а в старой карте сайта они были.
  return [...staticEntries, ...cityEntries, ...propertyEntries]
}
