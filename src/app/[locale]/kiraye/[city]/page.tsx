import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {getLocale, getTranslations} from 'next-intl/server'
import {Link} from '@/lib/navigation'
import {PropertyCard} from '@/components/property-card'
import {cityFromSlug, cityLandingPath, localizedCityName} from '@/lib/city-landing'
import {localeAlternates, localizePath, type LocaleCode} from '@/lib/locale-routes'
import {openGraphFor} from '@/lib/seo'
import type {Language, Property} from '@birklik/core/types'
import {getCitiesWithListings, getCityProperties} from './queries'
import {CityJsonLd} from './city-json-ld'
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
// Выдуманный регион отдаёт 200, а не 404: корневой loading.tsx открывает поток
// раньше, чем страница успевает решить. Убрать его нельзя — на нём держится
// запас по процессорному времени, см. `src/app/loading.tsx`. Поэтому такие
// адреса закрываются мета-тегом noindex в generateMetadata.
//
// Ограничить адреса через generateStaticParams + dynamicParams=false тоже не
// выходит: force-dynamic отменяет проверку списка, проверено на боевом.
export const dynamic = 'force-dynamic'

export async function generateMetadata({params}: PageProps): Promise<Metadata> {
  const {city: slug, locale} = await params
  const city = cityFromSlug(slug)
  // Выдуманный регион: страница отвечает 404, но метаданные считаются
  // параллельно с ней и могут успеть уйти. Закрываем и здесь.
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

  const title = t('landing.title', values)
  const description = t('landing.description', values)
  return {
    title,
    description,
    alternates: localeAlternates(cityLandingPath(city.value), locale as LocaleCode),
    openGraph: openGraphFor({
      title,
      description,
      path: localizePath(cityLandingPath(city.value), locale as LocaleCode),
      locale
    })
  }
}

// Минимальная цена за ночь по региону. Число живое и на каждой странице своё —
// в отличие от шаблонного текста, который поисковик у девяти почти одинаковых
// страниц вполне может счесть повторами.
function lowestNightlyPrice(properties: Property[]): number | undefined {
  const prices = properties
    .map(property => property.price?.daily)
    .filter((price): price is number => typeof price === 'number' && price > 0)
  return prices.length > 0 ? Math.min(...prices) : undefined
}

export default async function Page({params}: PageProps) {
  const {city: slug} = await params
  const city = cityFromSlug(slug)
  if (!city) notFound()

  const properties = await getCityProperties(city.value)
  const [locale, t] = await Promise.all([getLocale(), getTranslations('App')])
  const language = locale as Language
  const cityName = localizedCityName(city, language)
  const priceFrom = lowestNightlyPrice(properties)

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
      <CityJsonLd
        properties={properties}
        cityName={cityName}
        cityPath={cityLandingPath(city.value)}
        locale={locale}
      />

      <nav className="city-landing-crumbs" aria-label="breadcrumb">
        <Link to="/">{t('landing.allListings')}</Link>
      </nav>

      <header className="city-landing-head">
        <h1>{t('landing.heading', {city: cityName})}</h1>
        <p className="city-landing-count">{t('landing.found', {count: properties.length})}</p>
        {/* Связный абзац поверх сетки карточек. Без него страница региона —
            только плитка ссылок: человеку она понятна, разбору содержимого
            почти ничего не сообщает. Отсюда же ИИ-поиск берёт формулировку,
            когда его спрашивают про аренду в конкретном районе. */}
        <p className="city-landing-intro">
          {t('landing.intro', {city: cityName, count: properties.length})}
          {priceFrom !== undefined && ` ${t('landing.priceFrom', {price: priceFrom})}`}
        </p>
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
