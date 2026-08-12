'use server'

import {revalidateTag} from 'next/cache'
import {
  getDoc,
  queryDocs,
  updateDoc,
  runTransaction,
  generateDocumentId,
  arrayUnion,
  arrayRemove
} from '@/lib/firebase/firestore-rest'
import {getSession} from '@/lib/auth/session'
import type {Booking, Comment, Property, ReportReason} from '@/types'
import {propertyIdSchema, bookingSchema, commentSchema, replySchema, ratingSchema, reportCommentSchema} from './validators'
import {getProperty, getUserProfile, hasUserBookedProperty} from './queries'
import {createNotification} from './lib/create-notification'

export async function revalidatePropertyAction(propertyId: string) {
  const validatedPropertyId = propertyIdSchema.parse(propertyId)
  revalidateTag(`property:${validatedPropertyId}`, 'max')
}

class BookingConflictError extends Error {}
class DuplicateReportError extends Error {}

export type ActionResult<T extends object = object> = ({success: true} & T) | {success: false; error: string}

export async function createBookingAction(propertyId: string, checkInDate: string, checkOutDate: string): Promise<ActionResult<{booking: Booking}>> {
  const session = await getSession()
  if (!session) return {success: false, error: 'not-authenticated'}

  const parsed = bookingSchema.safeParse({propertyId, checkInDate, checkOutDate})
  if (!parsed.success) return {success: false, error: 'invalid-input'}

  const [property, profile] = await Promise.all([getProperty(parsed.data.propertyId), getUserProfile(session.uid)])
  if (!property) return {success: false, error: 'property-not-found'}

  const nights = Math.ceil(
    (new Date(parsed.data.checkOutDate).getTime() - new Date(parsed.data.checkInDate).getTime()) / (24 * 60 * 60 * 1000)
  )
  if (nights <= 0) return {success: false, error: 'invalid-dates'}

  const totalPrice = nights * property.price.daily
  const userName = profile?.name || 'User'

  try {
    const booking = await runTransaction(async transaction => {
      const conflicting = await transaction.query<Booking>('bookings', {
        where: [
          ['propertyId', '==', parsed.data.propertyId],
          ['status', 'in', ['approved', 'pending']]
        ]
      })

      const proposedCheckIn = new Date(parsed.data.checkInDate).getTime()
      const proposedCheckOut = new Date(parsed.data.checkOutDate).getTime()

      for (const existing of conflicting) {
        const existingCheckIn = new Date(existing.checkInDate).getTime()
        const existingCheckOut = new Date(existing.checkOutDate).getTime()
        if (proposedCheckIn < existingCheckOut && proposedCheckOut > existingCheckIn) {
          throw new BookingConflictError()
        }
      }

      const bookingId = generateDocumentId()
      const bookingData = {
        propertyId: parsed.data.propertyId,
        userId: session.uid,
        ownerId: property.ownerId || '',
        userName,
        userEmail: session.email || '',
        userPhone: profile?.phone || '',
        checkInDate: parsed.data.checkInDate,
        checkOutDate: parsed.data.checkOutDate,
        nights,
        totalPrice,
        status: 'pending' as const,
        createdAt: new Date().toISOString()
      }
      transaction.set('bookings', bookingId, bookingData)
      return {id: bookingId, ...bookingData}
    })

    if (property.ownerId) {
      await createNotification(property.ownerId, {
        userId: property.ownerId,
        type: 'booking',
        title: 'New booking request',
        message: `${userName} booked your property`,
        read: false,
        propertyId: property.id,
        bookingId: booking.id,
        bookerName: userName,
        bookerEmail: booking.userEmail,
        bookerPhone: booking.userPhone,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        relatedId: property.id,
        relatedUserId: session.uid,
        relatedUserName: userName
      })
    }

    revalidateTag(`property:${property.id}`, 'max')
    return {success: true, booking}
  } catch (error) {
    if (error instanceof BookingConflictError) return {success: false, error: 'booking-conflict'}
    return {success: false, error: 'unknown'}
  }
}

export async function toggleFavoriteAction(propertyId: string): Promise<ActionResult<{isFavorited: boolean}>> {
  const session = await getSession()
  if (!session) return {success: false, error: 'not-authenticated'}

  const parsedId = propertyIdSchema.safeParse(propertyId)
  if (!parsedId.success) return {success: false, error: 'invalid-input'}

  const property = await getDoc<Property>('properties', parsedId.data)
  if (!property) return {success: false, error: 'property-not-found'}

  const isFavorited = (property.favorites || []).includes(session.uid)

  await updateDoc('properties', parsedId.data, {
    favorites: isFavorited ? arrayRemove(session.uid) : arrayUnion(session.uid)
  })

  if (!isFavorited && property.ownerId && property.ownerId !== session.uid) {
    const profile = await getUserProfile(session.uid)
    const name = profile?.name || 'User'
    await createNotification(property.ownerId, {
      userId: property.ownerId,
      type: 'favorite',
      title: 'New favorite',
      message: `${name} added your property to favorites`,
      read: false,
      propertyId: parsedId.data,
      favoriterName: name,
      relatedId: parsedId.data,
      relatedUserId: session.uid,
      relatedUserName: name
    })
  }

  revalidateTag(`property:${parsedId.data}`, 'max')
  return {success: true, isFavorited: !isFavorited}
}

export async function addCommentAction(propertyId: string, text: string): Promise<ActionResult<{comment: Comment}>> {
  const session = await getSession()
  if (!session) return {success: false, error: 'not-authenticated'}

  const parsed = commentSchema.safeParse({propertyId, text})
  if (!parsed.success) return {success: false, error: 'invalid-input'}

  const [property, profile] = await Promise.all([
    getDoc<Property>('properties', parsed.data.propertyId),
    getUserProfile(session.uid)
  ])
  if (!property) return {success: false, error: 'property-not-found'}

  const newComment: Comment = {
    id: `${Date.now()}_${session.uid}`,
    userId: session.uid,
    userName: profile?.name || 'User',
    userAvatar: profile?.avatar || '',
    text: parsed.data.text,
    createdAt: new Date().toISOString()
  }

  await updateDoc('properties', parsed.data.propertyId, {
    comments: arrayUnion(newComment),
    updatedAt: new Date().toISOString()
  })

  if (property.ownerId && property.ownerId !== session.uid) {
    await createNotification(property.ownerId, {
      userId: property.ownerId,
      type: 'comment',
      title: 'New comment',
      message: `${newComment.userName} commented: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`,
      read: false,
      propertyId: parsed.data.propertyId,
      commentId: newComment.id,
      commenterName: newComment.userName,
      commentText: text,
      relatedId: parsed.data.propertyId,
      relatedUserId: session.uid,
      relatedUserName: newComment.userName
    })
  }

  revalidateTag(`property:${parsed.data.propertyId}`, 'max')
  return {success: true, comment: newComment}
}

export async function deleteCommentAction(propertyId: string, commentId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return {success: false, error: 'not-authenticated'}

  const parsedId = propertyIdSchema.safeParse(propertyId)
  if (!parsedId.success) return {success: false, error: 'invalid-input'}

  const property = await getDoc<Property>('properties', parsedId.data)
  if (!property) return {success: false, error: 'property-not-found'}

  const comments = property.comments || []
  const comment = comments.find(c => c.id === commentId)
  if (!comment) return {success: false, error: 'comment-not-found'}
  if (comment.userId !== session.uid && !session.moderator) return {success: false, error: 'forbidden'}

  await updateDoc('properties', parsedId.data, {
    comments: comments.filter(c => c.id !== commentId),
    updatedAt: new Date().toISOString()
  })

  revalidateTag(`property:${parsedId.data}`, 'max')
  return {success: true}
}

export async function addReplyAction(propertyId: string, parentCommentId: string, text: string): Promise<ActionResult<{reply: Comment}>> {
  const session = await getSession()
  if (!session) return {success: false, error: 'not-authenticated'}

  const parsed = replySchema.safeParse({propertyId, parentCommentId, text})
  if (!parsed.success) return {success: false, error: 'invalid-input'}

  const [property, profile] = await Promise.all([
    getDoc<Property>('properties', parsed.data.propertyId),
    getUserProfile(session.uid)
  ])
  if (!property) return {success: false, error: 'property-not-found'}

  const comments = property.comments || []
  if (!comments.some(c => c.id === parsed.data.parentCommentId)) {
    return {success: false, error: 'comment-not-found'}
  }

  const newReply: Comment = {
    id: `${Date.now()}_${session.uid}`,
    userId: session.uid,
    userName: profile?.name || 'User',
    userAvatar: profile?.avatar || '',
    text: parsed.data.text,
    createdAt: new Date().toISOString(),
    parentCommentId: parsed.data.parentCommentId
  }

  const updatedComments = comments.map(c =>
    c.id === parsed.data.parentCommentId ? {...c, replies: [...(c.replies || []), newReply]} : c
  )

  await updateDoc('properties', parsed.data.propertyId, {
    comments: updatedComments,
    updatedAt: new Date().toISOString()
  })

  revalidateTag(`property:${parsed.data.propertyId}`, 'max')
  return {success: true, reply: newReply}
}

export async function addRatingAction(propertyId: string, rating: number): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return {success: false, error: 'not-authenticated'}

  const parsed = ratingSchema.safeParse({propertyId, rating})
  if (!parsed.success) return {success: false, error: 'invalid-input'}

  const hasBooked = await hasUserBookedProperty(session.uid, parsed.data.propertyId)
  if (!hasBooked) return {success: false, error: 'not-booked'}

  const property = await getDoc<{ratings?: Record<string, number>; ownerId?: string}>(
    'properties',
    parsed.data.propertyId
  )
  if (!property) return {success: false, error: 'property-not-found'}

  const ratings = {...(property.ratings || {}), [session.uid]: parsed.data.rating}
  const values = Object.values(ratings)
  const average = values.reduce((a, b) => a + b, 0) / values.length

  await updateDoc('properties', parsed.data.propertyId, {
    ratings,
    rating: Math.round(average * 10) / 10,
    reviews: values.length,
    updatedAt: new Date().toISOString()
  })

  const ownerId = property.ownerId
  if (ownerId) {
    const profile = await getUserProfile(session.uid)
    const name = profile?.name || 'User'
    await createNotification(ownerId, {
      userId: ownerId,
      type: 'rating',
      title: `${parsed.data.rating} stars`,
      message: `${name} rated your property ${parsed.data.rating} stars`,
      read: false,
      propertyId: parsed.data.propertyId,
      raterName: name,
      ratingValue: parsed.data.rating,
      relatedId: parsed.data.propertyId,
      relatedUserId: session.uid,
      relatedUserName: name
    })
  }

  revalidateTag(`property:${parsed.data.propertyId}`, 'max')
  return {success: true}
}

export async function reportCommentAction(
  propertyId: string,
  commentId: string,
  commentText: string,
  reason: ReportReason,
  details?: string
): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return {success: false, error: 'not-authenticated'}

  const parsed = reportCommentSchema.safeParse({propertyId, commentId, commentText, reason, details})
  if (!parsed.success) return {success: false, error: 'invalid-input'}

  const profile = await getUserProfile(session.uid)
  const reportedByName = profile?.name || 'User'

  try {
    const created = await runTransaction(async transaction => {
      const existing = await transaction.query('commentReports', {
        where: [
          ['commentId', '==', parsed.data.commentId],
          ['reportedBy', '==', session.uid]
        ],
        limit: 1
      })
      if (existing.length > 0) throw new DuplicateReportError()

      const reportId = generateDocumentId()
      const reportData = {
        propertyId: parsed.data.propertyId,
        commentId: parsed.data.commentId,
        commentText: parsed.data.commentText,
        reportedBy: session.uid,
        reportedByName,
        reason: parsed.data.reason,
        details: parsed.data.details || '',
        createdAt: new Date().toISOString(),
        status: 'open' as const,
        commentDeleted: false
      }
      transaction.set('commentReports', reportId, reportData)
      return {id: reportId, ...reportData}
    })

    // Fan-out to moderators — mirrors the existing (Firestore `users.isModerator` field)
    // moderator lookup used elsewhere; moderator status is otherwise tracked via
    // Firebase custom claims, so this list may be incomplete — pre-existing behavior.
    const moderators = await queryDocs('users', {where: [['isModerator', '==', true]]})
    await Promise.all(
      moderators.map(moderator =>
        createNotification(moderator.id, {
          userId: moderator.id,
          type: 'commentReport',
          title: 'New comment report',
          message: `Report: ${created.reason}. Comment: "${created.commentText.slice(0, 50)}${created.commentText.length > 50 ? '...' : ''}"`,
          read: false,
          reportId: created.id,
          propertyId: created.propertyId,
          commentId: created.commentId,
          reason: created.reason,
          reportedBy: session.uid,
          relatedId: created.commentId,
          relatedUserId: session.uid,
          relatedUserName: reportedByName
        })
      )
    )

    return {success: true}
  } catch (error) {
    if (error instanceof DuplicateReportError) return {success: false, error: 'duplicate'}
    return {success: false, error: 'unknown'}
  }
}
