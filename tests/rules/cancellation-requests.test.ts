import {afterAll, beforeEach, describe, it} from 'vitest'
import {assertFails, assertSucceeds} from '@firebase/rules-unit-testing'
import {collection, doc, getDocs, query, setDoc, where} from 'firebase/firestore'
import {getTestEnv, authed, moderator, OWNER, GUEST, STRANGER, PROPERTY_ID} from './helpers'

// Проверяется боевой путь удаления брони. Сама бронь модератору была разрешена
// всегда, но deleteBooking сначала подчищает связанные запросы отмены — и вот
// этот поиск ему запрещали. Исключение обрывало всю функцию, в браузере
// появлялось permission-denied, бронь оставалась на месте.
//
// ⚠️ Firestore проверяет правила по УСЛОВИЯМ запроса, а не по найденным
// документам. Поэтому здесь именно запросы к коллекции, а не чтение документа
// по идентификатору: только так видно, что владельцу мало искать по одному
// bookingId — правило смотрит в ownerId, значит и запрос обязан.

const env = await getTestEnv()
const BOOKING_ID = 'booking-1'

function requestDoc(overrides: Record<string, unknown> = {}) {
  return {
    bookingId: BOOKING_ID,
    propertyId: PROPERTY_ID,
    ownerId: OWNER,
    guestId: GUEST,
    guestName: 'Guest',
    guestEmail: 'guest@example.com',
    checkInDate: '2026-10-01',
    checkOutDate: '2026-10-05',
    status: 'pending',
    ...overrides
  }
}

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'cancellationRequests', 'req-1'), requestDoc())
  })
})

afterAll(async () => {
  await env.cleanup()
})

const requests = (ctx: {firestore: () => any}) => collection(ctx.firestore(), 'cancellationRequests')

describe('cancellationRequests: поиск при удалении брони', () => {
  // Ровно то, что делает cleanupCancellationRequests для модератора: ветка
  // правила не касается полей документа, поэтому одного bookingId достаточно.
  it('модератор ищет по одному bookingId', async () => {
    await assertSucceeds(
      getDocs(query(requests(moderator(env)), where('bookingId', '==', BOOKING_ID)))
    )
  })

  it('владелец ищет по bookingId вместе с ownerId', async () => {
    await assertSucceeds(
      getDocs(query(
        requests(authed(env, OWNER)),
        where('bookingId', '==', BOOKING_ID),
        where('ownerId', '==', OWNER)
      ))
    )
  })

  // Так ищет deleteProperty, когда объявление удаляет ВЛАДЕЛЕЦ: одна выборка по
  // себе на всё объявление вместо запроса на каждую бронь. Ограничение по
  // ownerId совпадает с веткой правила, поэтому bookingId здесь не нужен.
  it('владелец ищет по одному ownerId — так удаляет своё объявление', async () => {
    await assertSucceeds(
      getDocs(query(requests(authed(env, OWNER)), where('ownerId', '==', OWNER)))
    )
  })

  it('гость ищет по bookingId вместе с guestId', async () => {
    await assertSucceeds(
      getDocs(query(
        requests(authed(env, GUEST)),
        where('bookingId', '==', BOOKING_ID),
        where('guestId', '==', GUEST)
      ))
    )
  })

  // Это и есть прежнее поведение кода: ограничения по владельцу нет, и запрос
  // отклоняется целиком — независимо от того, что в нём лежит.
  it('ЗАПРЕЩЕНО владельцу искать по одному bookingId', async () => {
    await assertFails(
      getDocs(query(requests(authed(env, OWNER)), where('bookingId', '==', BOOKING_ID)))
    )
  })

  it('ЗАПРЕЩЕНО постороннему выдавать себя за владельца', async () => {
    await assertFails(
      getDocs(query(
        requests(authed(env, STRANGER)),
        where('bookingId', '==', BOOKING_ID),
        where('ownerId', '==', OWNER)
      ))
    )
  })

  it('ЗАПРЕЩЕНО постороннему читать всю коллекцию', async () => {
    await assertFails(getDocs(requests(authed(env, STRANGER))))
  })
})
