import 'server-only'
import {revalidateTag} from 'next/cache'
import {arrayUnion, getDoc, updateDoc} from '@/lib/firebase/firestore-rest'
import type {Comment, Property} from '@birklik/core/types'
import {commentSchema, ratingSchema} from '../validators'
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
