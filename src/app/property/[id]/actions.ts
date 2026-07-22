'use server'

import {revalidateTag} from 'next/cache'
import {FieldValue} from 'firebase-admin/firestore'
import {adminDb} from '@/lib/firebase/admin'
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
  const bookingsRef = adminDb.collection('bookings')
  const userName = profile?.name || 'User'

  try {
    const booking = await adminDb.runTransaction(async transaction => {
      const conflicting = await transaction.get(
        bookingsRef.where('propertyId', '==', parsed.data.propertyId).where('status', 'in', ['approved', 'pending'])
      )

      const proposedCheckIn = new Date(parsed.data.checkInDate).getTime()
      const proposedCheckOut = new Date(parsed.data.checkOutDate).getTime()

      for (const doc of conflicting.docs) {
        const existing = doc.data() as Booking
        const existingCheckIn = new Date(existing.checkInDate).getTime()
        const existingCheckOut = new Date(existing.checkOutDate).getTime()
        if (proposedCheckIn < existingCheckOut && proposedCheckOut > existingCheckIn) {
          throw new BookingConflictError()
        }
      }

      const newDocRef = bookingsRef.doc()
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
      transaction.set(newDocRef, bookingData)
      return {id: newDocRef.id, ...bookingData}
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

  const propertyRef = adminDb.collection('properties').doc(parsedId.data)
  const snapshot = await propertyRef.get()
  if (!snapshot.exists) return {success: false, error: 'property-not-found'}

  const property = snapshot.data() as Property
  const isFavorited = (property.favorites || []).includes(session.uid)

  await propertyRef.update({
    favorites: isFavorited ? FieldValue.arrayRemove(session.uid) : FieldValue.arrayUnion(session.uid)
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

  const propertyRef = adminDb.collection('properties').doc(parsed.data.propertyId)
  const [snapshot, profile] = await Promise.all([propertyRef.get(), getUserProfile(session.uid)])
  if (!snapshot.exists) return {success: false, error: 'property-not-found'}
  const property = snapshot.data() as Property

  const newComment: Comment = {
    id: `${Date.now()}_${session.uid}`,
    userId: session.uid,
    userName: profile?.name || 'User',
    userAvatar: profile?.avatar || '',
    text: parsed.data.text,
    createdAt: new Date().toISOString()
  }

  await propertyRef.update({
    comments: FieldValue.arrayUnion(newComment),
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

  const propertyRef = adminDb.collection('properties').doc(parsedId.data)
  const snapshot = await propertyRef.get()
  if (!snapshot.exists) return {success: false, error: 'property-not-found'}

  const property = snapshot.data() as Property
  const comments = property.comments || []
  const comment = comments.find(c => c.id === commentId)
  if (!comment) return {success: false, error: 'comment-not-found'}
  if (comment.userId !== session.uid && !session.moderator) return {success: false, error: 'forbidden'}

  await propertyRef.update({
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

  const propertyRef = adminDb.collection('properties').doc(parsed.data.propertyId)
  const [snapshot, profile] = await Promise.all([propertyRef.get(), getUserProfile(session.uid)])
  if (!snapshot.exists) return {success: false, error: 'property-not-found'}

  const property = snapshot.data() as Property
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

  await propertyRef.update({comments: updatedComments, updatedAt: new Date().toISOString()})

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

  const propertyRef = adminDb.collection('properties').doc(parsed.data.propertyId)
  const snapshot = await propertyRef.get()
  if (!snapshot.exists) return {success: false, error: 'property-not-found'}

  const property = snapshot.data() as Record<string, unknown>
  const ratings = {...((property.ratings as Record<string, number>) || {}), [session.uid]: parsed.data.rating}
  const values = Object.values(ratings)
  const average = values.reduce((a, b) => a + b, 0) / values.length

  await propertyRef.update({
    ratings,
    rating: Math.round(average * 10) / 10,
    reviews: values.length,
    updatedAt: new Date().toISOString()
  })

  const ownerId = property.ownerId as string | undefined
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
  const reportsRef = adminDb.collection('commentReports')

  try {
    const created = await adminDb.runTransaction(async transaction => {
      const existing = await transaction.get(
        reportsRef.where('commentId', '==', parsed.data.commentId).where('reportedBy', '==', session.uid)
      )
      if (!existing.empty) throw new DuplicateReportError()

      const reportRef = reportsRef.doc()
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
      transaction.set(reportRef, reportData)
      return {id: reportRef.id, ...reportData}
    })

    // Fan-out to moderators — mirrors the existing (Firestore `users.isModerator` field)
    // moderator lookup used elsewhere; moderator status is otherwise tracked via
    // Firebase custom claims, so this list may be incomplete — pre-existing behavior.
    const moderators = await adminDb.collection('users').where('isModerator', '==', true).get()
    await Promise.all(
      moderators.docs.map(moderatorDoc =>
        createNotification(moderatorDoc.id, {
          userId: moderatorDoc.id,
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
