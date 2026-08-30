import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {PropertyDetails} from './components/property-details'
import {PropertyJsonLd} from './components/property-json-ld'
import {getSession} from '@/lib/auth/session'
import {
  getPropertyMetadata,
  getProperty,
  getPropertyBookingsForAvailability,
  getSimilarProperties,
  hasUserBookedProperty,
  getUserRatingForProperty,
  recordPropertyView
} from './queries'
import {propertyIdSchema} from './validators'
import {getLocale} from 'next-intl/server'
import {cityFromSlug, cityLandingPath, citySlug, localizedCityName} from '@/lib/city-landing'
import type {Language} from '@/types'

type PropertyRouteProps = {params: Promise<{id: string}>}

// Несуществующее объявление отдаёт настоящий 404: проверку делает layout,
// который резолвится до границы Suspense от loading.tsx (см. комментарий там).
// Раньше здесь уходил код 200, и мета-тег был единственной защитой.
//
// Оставлен и он: generateMetadata считается параллельно со страницей и может
// успеть отдать заголовок для адреса, которого нет. noindex и БЕЗ canonical —
// canonical на несуществующий адрес был прямым приглашением его проиндексировать.
const NOT_FOUND_METADATA: Metadata = {
  title: 'Property',
  robots: {index: false, follow: false}
}

export async function generateMetadata({params}: PropertyRouteProps): Promise<Metadata> {
  const parsedId = propertyIdSchema.safeParse((await params).id)
  if (!parsedId.success) return NOT_FOUND_METADATA
  const property = await getPropertyMetadata(parsedId.data)
  if (!property) return NOT_FOUND_METADATA
  return {
    title: property.title,
    description: property.description,
    // Канонический адрес: у объявления один URL, но до него добираются с
    // разными хвостами вроде utm-меток — без canonical поисковик считает их
    // разными страницами и дробит вес.
    alternates: {canonical: `/property/${parsedId.data}`},
    // Здесь стояло только `images` — и этого хватало, чтобы Next отбросил весь
    // OpenGraph из корневого layout: он подменяет ключ целиком, а не сливает
    // поля. Ссылка на объявление разворачивалась с фотографией, но без названия
    // сайта и без подписи. Поэтому неизменная часть повторена явно.
    openGraph: {
      type: 'website',
      siteName: 'Birklik.az',
      title: `${property.title} | Birklik.az`,
      description: property.description,
      url: `/property/${parsedId.data}`,
      ...(property.image ? {images: [property.image]} : {})
    }
  }
}

export default async function Page({params}: PropertyRouteProps) {
  const parsedId = propertyIdSchema.safeParse((await params).id)
  if (!parsedId.success) notFound()

  const property = await getProperty(parsedId.data)
  if (!property) notFound()

  const session = await getSession()

  const [bookings, similarProperties, hasBooked, userRating] = await Promise.all([
    getPropertyBookingsForAvailability(parsedId.data),
    getSimilarProperties(property),
    session ? hasUserBookedProperty(session.uid, parsedId.data) : Promise.resolve(false),
    session ? getUserRatingForProperty(parsedId.data, session.uid) : Promise.resolve(null)
  ])

  recordPropertyView(parsedId.data)

  // Заголовок и описание берём из того же кэшированного источника, что и
  // мета-теги, чтобы разметка и <title> не разъезжались.
  const seo = await getPropertyMetadata(parsedId.data)

  // Регион для хлебных крошек. Берём из справочника: у части старых объявлений
  // city пустой или записан вне списка — тогда крошек просто не будет.
  const [locale, cityOption] = await Promise.all([
    getLocale(),
    Promise.resolve(property.city ? cityFromSlug(citySlug(property.city)) : undefined)
  ])

  return (
    <>
      <PropertyJsonLd
        property={property}
        title={seo?.title ?? ''}
        description={seo?.description ?? ''}
        cityName={cityOption ? localizedCityName(cityOption, locale as Language) : undefined}
        cityPath={cityOption ? cityLandingPath(cityOption.value) : undefined}
      />
      <PropertyDetails
        property={property}
        bookings={bookings}
        similarProperties={similarProperties}
        isAuthenticated={!!session}
        isOwner={session?.uid === property.ownerId}
        isFavorited={session ? (property.favorites || []).includes(session.uid) : false}
        hasBooked={hasBooked}
        userRating={userRating}
        currentUserId={session?.uid ?? null}
      />
    </>
  )
}
