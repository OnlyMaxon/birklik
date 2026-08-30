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

type PropertyRouteProps = {params: Promise<{id: string}>}

// Несуществующее объявление отдаёт код 200, а не 404: корневой loading.tsx
// открывает поток раньше, чем страница успевает вызвать notFound(), и статус
// уже отправлен. Пользователь при этом видит правильную страницу «не найдено»,
// а вот поисковик — обычный ответ 200. Раз статусом не отбиться, отбиваемся
// мета-тегом: noindex и БЕЗ canonical. Отдавать canonical на несуществующий
// адрес было прямым приглашением его проиндексировать.
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

  return (
    <>
      <PropertyJsonLd
        property={property}
        title={seo?.title ?? ''}
        description={seo?.description ?? ''}
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
