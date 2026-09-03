import {afterAll, beforeEach, describe, it} from 'vitest'
import {assertFails, assertSucceeds} from '@firebase/rules-unit-testing'
import {doc, setDoc, updateDoc, deleteDoc, getDoc} from 'firebase/firestore'
import {
  getTestEnv, authed, anon, moderator,
  OWNER, GUEST, STRANGER, PROPERTY_ID, propertyDoc, bookingDoc
} from './helpers'

const env = await getTestEnv()
const BOOKING_ID = 'booking-1'

async function seed(booking: Record<string, unknown> = {}) {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'properties', PROPERTY_ID), propertyDoc())
    await setDoc(doc(db, 'bookings', BOOKING_ID), bookingDoc(booking))
  })
}

beforeEach(() => seed())

afterAll(async () => {
  await env.cleanup()
})

const booking = (ctx: {firestore: () => any}) => doc(ctx.firestore(), 'bookings', BOOKING_ID)

describe('bookings: чтение', () => {
  // Читать может любой вошедший — иначе не проверить пересечение дат при
  // создании новой брони.
  it('вошедший читает бронь', async () => {
    await assertSucceeds(getDoc(booking(authed(env, STRANGER))))
  })

  it('ЗАПРЕЩЕНО невошедшему', async () => {
    await assertFails(getDoc(booking(anon(env))))
  })
})

describe('bookings: создание', () => {
  const fresh = (ctx: {firestore: () => any}) => doc(ctx.firestore(), 'bookings', 'booking-new')

  it('гость создаёт свою бронь со статусом pending', async () => {
    await assertSucceeds(setDoc(fresh(authed(env, GUEST)), bookingDoc({id: 'booking-new'})))
  })

  it('ЗАПРЕЩЕНО создавать бронь от чужого имени', async () => {
    await assertFails(
      setDoc(fresh(authed(env, STRANGER)), bookingDoc({id: 'booking-new', userId: GUEST}))
    )
  })

  it('ЗАПРЕЩЕНО создавать бронь сразу подтверждённой', async () => {
    await assertFails(
      setDoc(fresh(authed(env, GUEST)), bookingDoc({id: 'booking-new', status: 'approved'}))
    )
  })
})

describe('bookings: гость отменяет', () => {
  it('свою неподтверждённую бронь отменяет сам', async () => {
    await assertSucceeds(updateDoc(booking(authed(env, GUEST)), {status: 'cancelled'}))
  })

  it('ЗАПРЕЩЕНО отменять чужую бронь', async () => {
    await assertFails(updateDoc(booking(authed(env, STRANGER)), {status: 'cancelled'}))
  })

  // Добавлено аудитом: подтверждённую бронь гость не отменяет сам, а просит.
  it('по подтверждённой брони поднимает запрос на отмену', async () => {
    await seed({status: 'approved'})
    await assertSucceeds(
      updateDoc(booking(authed(env, GUEST)), {status: 'cancellation_requested'})
    )
  })

  it('ЗАПРЕЩЕНО отменять подтверждённую бронь напрямую', async () => {
    await seed({status: 'approved'})
    await assertFails(updateDoc(booking(authed(env, GUEST)), {status: 'cancelled'}))
  })

  it('ЗАПРЕЩЕНО вместе с запросом менять что-то ещё', async () => {
    await seed({status: 'approved'})
    await assertFails(
      updateDoc(booking(authed(env, GUEST)), {status: 'cancellation_requested', totalPrice: 1})
    )
  })
})

describe('bookings: владелец', () => {
  it('подтверждает заявку', async () => {
    await assertSucceeds(updateDoc(booking(authed(env, OWNER)), {status: 'approved'}))
  })

  it('отклоняет заявку', async () => {
    await assertSucceeds(updateDoc(booking(authed(env, OWNER)), {status: 'rejected'}))
  })

  it('ЗАПРЕЩЕНО подтверждать бронь на ЧУЖОМ объявлении', async () => {
    await assertFails(updateDoc(booking(authed(env, STRANGER)), {status: 'approved'}))
  })

  // Вторая половина сценария отмены: владелец отвечает на запрос гостя.
  it('подтверждает отмену', async () => {
    await seed({status: 'cancellation_requested'})
    await assertSucceeds(updateDoc(booking(authed(env, OWNER)), {status: 'cancelled'}))
  })

  it('оставляет бронь в силе', async () => {
    await seed({status: 'cancellation_requested'})
    await assertSucceeds(updateDoc(booking(authed(env, OWNER)), {status: 'approved'}))
  })

  it('ЗАПРЕЩЕНО отвечать на запрос по чужому объявлению', async () => {
    await seed({status: 'cancellation_requested'})
    await assertFails(updateDoc(booking(authed(env, STRANGER)), {status: 'cancelled'}))
  })
})

describe('bookings: удаление', () => {
  it('гость удаляет свою отменённую бронь', async () => {
    await seed({status: 'cancelled'})
    await assertSucceeds(deleteDoc(booking(authed(env, GUEST))))
  })

  it('ЗАПРЕЩЕНО гостю удалять действующую бронь', async () => {
    await assertFails(deleteDoc(booking(authed(env, GUEST))))
  })

  it('владелец объявления удаляет бронь', async () => {
    await assertSucceeds(deleteDoc(booking(authed(env, OWNER))))
  })

  // Ради этого isModerator() и стоит первым в правиле: следующая ветка читает
  // документ объявления, а у части боевых броней объявление уже удалено —
  // get() вернул бы null и оборвал проверку ошибкой, не дойдя до модератора.
  it('модератор удаляет бронь, у которой объявление уже удалено', async () => {
    await env.clearFirestore()
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'bookings', BOOKING_ID), bookingDoc({propertyId: 'нет-такого'}))
    })
    await assertSucceeds(deleteDoc(booking(moderator(env))))
  })

  it('ЗАПРЕЩЕНО постороннему удалять бронь-сироту', async () => {
    await env.clearFirestore()
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'bookings', BOOKING_ID), bookingDoc({propertyId: 'нет-такого'}))
    })
    await assertFails(deleteDoc(booking(authed(env, STRANGER))))
  })
})
