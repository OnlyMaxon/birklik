import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {PropertyPage} from './components/property-page'
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

export async function generateMetadata({params}: PropertyRouteProps): Promise<Metadata> {
  const parsedId = propertyIdSchema.safeParse((await params).id)
  if (!parsedId.success) return {title: 'Property'}
  const property = await getPropertyMetadata(parsedId.data)
  return {
    title: property?.title ?? 'Property',
    description: property?.description,
    openGraph: property?.image ? {images: [property.image]} : undefined
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

  return (
    <PropertyPage
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
  )
}
