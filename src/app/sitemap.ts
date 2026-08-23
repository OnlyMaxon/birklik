import type {MetadataRoute} from 'next'
import {queryDocs} from '@/lib/firebase/firestore-rest'

const SITE_URL = 'https://birklik.az'

// Карта пересобирается раз в час: объявления появляются и уходят с модерации
// постоянно, а держать её вечной бессмысленно.
export const revalidate = 3600

// Потолок на случай роста базы. У поисковиков предел 50 000 адресов на файл,
// до него далеко, но неограниченный запрос в Firestore лучше не оставлять.
const MAX_PROPERTIES = 5000

const STATIC_PAGES: Array<{path: string; changeFrequency: 'daily' | 'monthly' | 'yearly'; priority: number}> = [
  {path: '/', changeFrequency: 'daily', priority: 1},
  {path: '/about', changeFrequency: 'monthly', priority: 0.5},
  {path: '/contact', changeFrequency: 'monthly', priority: 0.5},
  {path: '/terms', changeFrequency: 'yearly', priority: 0.3},
  {path: '/privacy', changeFrequency: 'yearly', priority: 0.3},
  {path: '/user-agreement', changeFrequency: 'yearly', priority: 0.3}
]

type SitemapProperty = {updatedAt?: string; createdAt?: string}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = STATIC_PAGES.map(page => ({
    url: `${SITE_URL}${page.path}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority
  }))

  let properties: Array<SitemapProperty & {id: string}> = []
  try {
    properties = await queryDocs<SitemapProperty>('properties', {
      // Только опубликованные: черновики, скрытые и ждущие модерации в выдаче
      // не нужны, а страницы у них всё равно закрыты.
      where: [['status', '==', 'active']],
      select: ['updatedAt', 'createdAt'],
      limit: MAX_PROPERTIES
    })
  } catch {
    // Firestore недоступен — отдаём хотя бы статические страницы, пустая карта
    // сайта хуже неполной.
    return staticEntries
  }

  const propertyEntries: MetadataRoute.Sitemap = properties.map(property => ({
    url: `${SITE_URL}/property/${property.id}`,
    lastModified: new Date(property.updatedAt || property.createdAt || now),
    changeFrequency: 'weekly',
    priority: 0.8
  }))

  // Страницы входа, регистрации и личного кабинета намеренно не включены:
  // индексировать их незачем, а в старой карте сайта они были.
  return [...staticEntries, ...propertyEntries]
}
