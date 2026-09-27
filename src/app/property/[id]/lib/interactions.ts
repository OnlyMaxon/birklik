import 'server-only'
import {revalidateTag} from 'next/cache'
import {
  arrayUnion,
  getDoc,
  generateDocumentId,
  queryDocs,
  runTransaction,
  updateDoc
} from '@/lib/firebase/firestore-rest'
import type {Comment, Property, ReportReason} from '@birklik/core/types'
import {commentSchema, ratingSchema, reportCommentSchema} from '../validators'
import {getUserProfile, hasUserBookedProperty} from '../queries'
import {createNotification} from './create-notification'

/**
 * Комментарии и оценки объявления.
 *
 * ⚠️ Вынесено сюда из серверных экшенов, чтобы у сайта и приложения была ОДНА
 * реализация. Раньше логика жила прямо в экшенах и брала вошедшего из
 * сессионной куки — приложению такой вход недоступен, у него токен в заголовке.
 * Скопировать было бы проще всего и хуже всего: два набора правил про то, кто
 * может оценивать и что уходит владельцу в уведомление, разошлись бы незаметно.
 *
 * Поэтому личность передаётся аргументом, а откуда она взялась — забота
 * вызывающего: экшен читает куку, обработчик адреса `/api` проверяет токен.
 *
 * Писать это может только сервер: правила Firestore запрещают клиенту трогать
 * `comments`, `ratings` и `reviews` — раньше через них можно было переписать
 * чужие отзывы и выставить оценку на чужом объявлении.
 */

export type InteractionResult<T extends object = object> =
  | ({success: true} & T)
  | {success: false; error: string}

export interface Actor {
  uid: string
}

export async function addComment(
  actor: Actor,
  propertyId: string,
  text: string
): Promise<InteractionResult<{comment: Comment}>> {
  const parsed = commentSchema.safeParse({propertyId, text})
  if (!parsed.success) return {success: false, error: 'invalid-input'}

  const [property, profile] = await Promise.all([
    getDoc<Property>('properties', parsed.data.propertyId),
    getUserProfile(actor.uid)
  ])
  if (!property) return {success: false, error: 'property-not-found'}

  const newComment: Comment = {
    id: `${Date.now()}_${actor.uid}`,
    userId: actor.uid,
    userName: profile?.name || 'User',
    userAvatar: profile?.avatar || '',
    text: parsed.data.text,
    createdAt: new Date().toISOString()
  }

  await updateDoc('properties', parsed.data.propertyId, {
    comments: arrayUnion(newComment),
    updatedAt: new Date().toISOString()
  })

  // Себе уведомление не шлём: владелец, комментирующий своё объявление, получил
  // бы письмо от самого себя.
  if (property.ownerId && property.ownerId !== actor.uid) {
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
      relatedUserId: actor.uid,
      relatedUserName: newComment.userName
    })
  }

  revalidateTag(`property:${parsed.data.propertyId}`, 'max')
  return {success: true, comment: newComment}
}

export async function addRating(
  actor: Actor,
  propertyId: string,
  rating: number
): Promise<InteractionResult<{rating: number; reviews: number}>> {
  const parsed = ratingSchema.safeParse({propertyId, rating})
  if (!parsed.success) return {success: false, error: 'invalid-input'}

  // Оценивать может только тот, кто здесь останавливался. Иначе оценки
  // превращаются в способ свести счёты с чужим объявлением.
  const hasBooked = await hasUserBookedProperty(actor.uid, parsed.data.propertyId)
  if (!hasBooked) return {success: false, error: 'not-booked'}

  const property = await getDoc<{ratings?: Record<string, number>; ownerId?: string}>(
    'properties',
    parsed.data.propertyId
  )
  if (!property) return {success: false, error: 'property-not-found'}

  // Оценки хранятся картой «кто → сколько», а не списком: так повторная оценка
  // заменяет прежнюю, а не добавляет вторую от того же человека.
  const ratings = {...(property.ratings || {}), [actor.uid]: parsed.data.rating}
  const values = Object.values(ratings)
  const average = values.reduce((a, b) => a + b, 0) / values.length
  const rounded = Math.round(average * 10) / 10

  await updateDoc('properties', parsed.data.propertyId, {
    ratings,
    rating: rounded,
    reviews: values.length,
    updatedAt: new Date().toISOString()
  })

  if (property.ownerId) {
    const profile = await getUserProfile(actor.uid)
    const name = profile?.name || 'User'
    await createNotification(property.ownerId, {
      userId: property.ownerId,
      type: 'rating',
      title: `${parsed.data.rating} stars`,
      message: `${name} rated your property ${parsed.data.rating} stars`,
      read: false,
      propertyId: parsed.data.propertyId,
      raterName: name,
      ratingValue: parsed.data.rating,
      relatedId: parsed.data.propertyId,
      relatedUserId: actor.uid,
      relatedUserName: name
    })
  }

  revalidateTag(`property:${parsed.data.propertyId}`, 'max')
  return {success: true, rating: rounded, reviews: values.length}
}


/** Повторная жалоба того же человека на тот же отзыв. */
export class DuplicateReportError extends Error {}

/**
 * Жалоба на отзыв.
 *
 * ⚠️ Здесь же, а не в экшене, ровно по той причине, что описана наверху файла:
 * жалобу подают и с сайта, и из приложения. Правило «одна жалоба на отзыв от
 * человека», состав записи и рассылка модераторам обязаны совпадать, иначе
 * очередь модерации начнёт вести себя по-разному в зависимости от того, откуда
 * пришли.
 */
export async function reportComment(
  actor: Actor,
  propertyId: string,
  commentId: string,
  commentText: string,
  reason: ReportReason,
  details?: string
): Promise<InteractionResult> {
  const parsed = reportCommentSchema.safeParse({propertyId, commentId, commentText, reason, details})
  if (!parsed.success) return {success: false, error: 'invalid-input'}

  const profile = await getUserProfile(actor.uid)
  const reportedByName = profile?.name || 'User'

  try {
    const created = await runTransaction(async transaction => {
      const existing = await transaction.query('commentReports', {
        where: [
          ['commentId', '==', parsed.data.commentId],
          ['reportedBy', '==', actor.uid]
        ],
        limit: 1
      })
      if (existing.length > 0) throw new DuplicateReportError()

      const reportId = generateDocumentId()
      const reportData = {
        propertyId: parsed.data.propertyId,
        commentId: parsed.data.commentId,
        commentText: parsed.data.commentText,
        reportedBy: actor.uid,
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

    // Рассылка модераторам по полю `users.isModerator`. ⚠️ Метка модератора
    // вообще-то живёт в claim токена, поэтому список может быть неполным —
    // поведение прежнее, сохранено как было.
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
          reportedBy: actor.uid,
          relatedId: created.commentId,
          relatedUserId: actor.uid,
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
