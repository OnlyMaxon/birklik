import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {getLocale, getTranslations} from 'next-intl/server'
import {Link} from '@/lib/navigation'
import {PropertyCard} from '@/components/property-card'
import {cityFromSlug, cityLandingPath, localizedCityName} from '@/lib/city-landing'
import {localeAlternates, type LocaleCode} from '@/lib/locale-routes'
import type {Language} from '@/types'
import {getCitiesWithListings, getCityProperties} from './queries'
import './city-landing.css'

// Посадочные страницы по регионам. Заводились ради двух вещей сразу:
//
// 1. Внутренние ссылки. На главной в HTML попадали ссылки только на первую
//    страницу выдачи — до остальных объявлений поисковик добирался лишь через
//    карту сайта, а такие страницы он считает менее важными.
// 2. Длинный хвост запросов («Qəbələdə ev kirayəsi»), где крупные площадки
//    не конкуренты: отдельных страниц под регион у них нет.
//
// Города берутся из справочника, но страница живёт, только если объявления в
// регионе есть — пустая посадочная хуже отсутствующей.

interface PageProps {
  params: Promise<{city: string; locale: string}>
}

// Страница ходит в Firestore на каждый запрос. Собирать её заранее нельзя:
// scripts/cf-build.mjs на время сборки прячет ключ сервис-аккаунта, запрос бы
// не прошёл — ровно на этом однажды погорела карта сайта.
//
// Пробовал ограничить адреса через generateStaticParams + dynamicParams=false,
// чтобы выдуманный регион отдавал настоящий 404 силами роутера. Не работает:
// force-dynamic отменяет проверку списка, /kiraye/xyz всё равно доходит до
// страницы. Проверено на боевом. Поэтому выдуманные адреса закрываются
// мета-тегом noindex в generateMetadata, а не кодом ответа.
export const dynamic = 'force-dynamic'

export async function generateMetadata({params}: PageProps): Promise<Metadata> {
  const {city: slug, locale} = await params
  const city = cityFromSlug(slug)
  // Выдуманный регион. Настоящий 404 отсюда не выдать — корневой loading.tsx
  // открывает поток раньше, чем страница успевает решить, и код ответа уже
  // отправлен (та же причина, по которой 200 отдаёт несуществующее
  // объявление). Раз статусом не отбиться, отбиваемся мета-тегом: страницу
  // видно, но в индекс она не попадёт.
  if (!city) return {robots: {index: false, follow: false}}

  const t = await getTranslations('App')
  const properties = await getCityProperties(city.value)

  const cityName = localizedCityName(city, locale as Language)
  const values = {city: cityName, count: properties.length}

  // Регион без объявлений — страница живая, но закрыта от индексации: пустышка
  // в выдаче не нужна ни нам, ни человеку. Появятся объявления — откроется
  // сама, вручную ничего включать не придётся.
  if (properties.length === 0) {
    return {title: t('landing.title', values), robots: {index: false, follow: true}}
  }

  return {
    title: t('landing.title', values),
    description: t('landing.description', values),
    alternates: localeAlternates(cityLandingPath(city.value), locale as LocaleCode)
  }
}

export default async function Page({params}: PageProps) {
  const {city: slug} = await params
  const city = cityFromSlug(slug)
  if (!city) notFound()

  const properties = await getCityProperties(city.value)
  const [locale, t] = await Promise.all([getLocale(), getTranslations('App')])
  const language = locale as Language
  const cityName = localizedCityName(city, language)

  // Соседние регионы — тоже внутренние ссылки, и посетителю есть куда пойти,
  // если здесь не нашлось подходящего. Только заполненные: справочник городов
  // куда шире реальной географии, а вести человека в пустой регион незачем.
  // Для региона без объявлений этот блок оказывается единственным содержимым —
  // потому и не 404: уйти отсюда есть куда.
  const otherCities = (await getCitiesWithListings())
    .filter(entry => entry.city !== city.value)
    .map(entry => ({option: cityFromSlug(entry.city.toLowerCase()), count: entry.count}))
    .filter((entry): entry is {option: NonNullable<typeof entry.option>; count: number} =>
      entry.option !== undefined
    )

  return (
    <div className="city-landing container">
      <nav className="city-landing-crumbs" aria-label="breadcrumb">
        <Link to="/">{t('landing.allListings')}</Link>
      </nav>

      <header className="city-landing-head">
        <h1>{t('landing.heading', {city: cityName})}</h1>
        <p className="city-landing-count">{t('landing.found', {count: properties.length})}</p>
      </header>

      <div className="city-landing-grid">
        {properties.map((property, index) => (
          <PropertyCard key={property.id} property={property} priority={index < 4} />
        ))}
      </div>

      <section className="city-landing-others">
        <h2>{t('landing.otherRegions')}</h2>
        <ul>
          {otherCities.map(({option, count}) => (
            <li key={option.value}>
              <Link to={cityLandingPath(option.value)}>
                {localizedCityName(option, language)} <span className="city-landing-badge">{count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
