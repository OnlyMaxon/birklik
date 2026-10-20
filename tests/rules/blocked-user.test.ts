import {afterAll, beforeEach, describe, it} from 'vitest'
import {assertFails, assertSucceeds} from '@firebase/rules-unit-testing'
import {doc, getDoc, setDoc, updateDoc, deleteDoc} from 'firebase/firestore'
import {
  getTestEnv,
  authed,
  anon,
  blocked,
  moderator,
  propertyDoc,
  bookingDoc,
  OWNER,
  GUEST,
  STRANGER,
  PROPERTY_ID
} from './helpers'

const env = await getTestEnv()

// Блокировка человека модератором. Требование Apple к приложениям с чужим
// контентом (правило 1.2) — жалоба, контакты и возможность заблокировать
// нарушителя; третьего у нас не было.
//
// ⚠️ Правила — ОДНА из двух половин запрета, и эти тесты проверяют только её:
// то, что клиент пишет напрямую (объявления, брони) и собственный профиль.
// Комментарии и оценки пишет сервер под сервис-аккаунтом, правила его не
// касаются вовсе, и тот запрет живёт в `interactions.ts` — сюда он не попадает
// не по забывчивости, а потому что проверять здесь было бы нечего.

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'properties', PROPERTY_ID), propertyDoc())
    await setDoc(doc(ctx.firestore(), 'users', OWNER), {name: 'Owner', email: 'o@e.az'})
    await setDoc(doc(ctx.firestore(), 'blockAudit', 'entry-1'), {
      userId: OWNER,
      email: 'o@e.az',
      action: 'blocked',
      reason: 'накрутка отзывов',
      listings: 2,
      by: 'moderator-uid',
      at: new Date().toISOString()
    })
  })
})

afterAll(async () => {
  await env.cleanup()
})

const property = (ctx: {firestore: () => any}) => doc(ctx.firestore(), 'properties', PROPERTY_ID)
const profile = (ctx: {firestore: () => any}, uid: string) => doc(ctx.firestore(), 'users', uid)

const newListing = () => propertyDoc({status: 'pending', favorites: [], views: 0})

describe('объявления: заблокированный не публикует', () => {
  it('обычный человек создаёт объявление', async () => {
    await assertSucceeds(
      setDoc(doc(authed(env, STRANGER).firestore(), 'properties', 'new-1'),
        propertyDoc({ownerId: STRANGER, status: 'pending'}))
    )
  })

  it('заблокированный создать объявление не может', async () => {
    await assertFails(
      setDoc(doc(blocked(env, STRANGER).firestore(), 'properties', 'new-2'),
        propertyDoc({ownerId: STRANGER, status: 'pending'}))
    )
  })

  it('владелец правит своё объявление', async () => {
    await assertSucceeds(updateDoc(property(authed(env, OWNER)), {title: 'Новое название'}))
  })

  it('заблокированный владелец своё объявление уже не правит', async () => {
    await assertFails(updateDoc(property(blocked(env, OWNER)), {title: 'Новое название'}))
  })

  it('заблокированный не удаляет своё объявление — удаление оставлено открытым намеренно', async () => {
    // Удаление заблокированному НЕ запрещено: человек вправе убрать свои данные,
    // и мешать ему в этом блокировка не должна. Тест закрепляет решение, чтобы
    // оно не было принято заново случайно.
    await assertSucceeds(deleteDoc(property(blocked(env, OWNER))))
  })
})

describe('избранное: заблокированному оставлено', () => {
  it('заблокированный может отметить объявление в избранном', async () => {
    // Намеренно: отметка «в избранном» видна только ему самому и никому не
    // мешает. Запрещать её значило бы наказывать за просмотр, а блокировка у нас
    // про публикацию и общение.
    await assertSucceeds(
      updateDoc(property(blocked(env, STRANGER)), {favorites: [STRANGER]})
    )
  })
})

describe('брони: заблокированный не бронирует', () => {
  it('обычный гость создаёт бронь', async () => {
    await assertSucceeds(
      setDoc(doc(authed(env, GUEST).firestore(), 'bookings', 'b-1'), bookingDoc())
    )
  })

  it('заблокированный гость бронь не создаёт', async () => {
    await assertFails(
      setDoc(doc(blocked(env, GUEST).firestore(), 'bookings', 'b-2'), bookingDoc())
    )
  })
})

describe('профиль: признак блокировки себе не поправить', () => {
  it('человек правит своё имя как раньше', async () => {
    await assertSucceeds(updateDoc(profile(authed(env, OWNER), OWNER), {name: 'Другое имя'}))
  })

  it('не может снять себе blocked', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'users', OWNER),
        {name: 'Owner', blocked: true, blockedReason: 'причина'}, {merge: true})
    })
    await assertFails(updateDoc(profile(blocked(env, OWNER), OWNER), {blocked: false}))
  })

  it('не может стереть причину', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'users', OWNER),
        {name: 'Owner', blocked: true, blockedReason: 'причина'}, {merge: true})
    })
    await assertFails(updateDoc(profile(blocked(env, OWNER), OWNER), {blockedReason: ''}))
  })

  it('не может выписать себе blocked при создании профиля', async () => {
    await assertFails(
      setDoc(profile(authed(env, STRANGER), STRANGER), {name: 'X', email: 'x@e.az', blocked: false})
    )
  })
})

describe('hiddenByBlock: пометка снятого блокировкой', () => {
  it('владелец не может стереть пометку — иначе разблокировка ему ничего не вернёт', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'properties', PROPERTY_ID),
        propertyDoc({status: 'inactive', hiddenByBlock: true}))
    })
    await assertFails(updateDoc(property(authed(env, OWNER)), {hiddenByBlock: false}))
  })

  it('владелец не может выставить пометку сам', async () => {
    await assertFails(updateDoc(property(authed(env, OWNER)), {hiddenByBlock: true}))
  })

  it('модератор пометку менять может — через его редактор идут и ручные правки', async () => {
    await assertSucceeds(updateDoc(property(moderator(env)), {hiddenByBlock: true}))
  })
})

describe('blockAudit: журнал блокировок', () => {
  const record = (ctx: {firestore: () => any}) => doc(ctx.firestore(), 'blockAudit', 'entry-1')

  it('модератор журнал читает', async () => {
    await assertSucceeds(getDoc(record(moderator(env))))
  })

  it('заблокированному журнал закрыт — свою причину он видит в профиле', async () => {
    await assertFails(getDoc(record(blocked(env, OWNER))))
  })

  it('посторонний журнал не читает', async () => {
    await assertFails(getDoc(record(authed(env, STRANGER))))
  })

  it('неизвестный журнал не читает', async () => {
    await assertFails(getDoc(record(anon(env))))
  })

  it('запись закрыта даже модератору — журнал, который можно подправить, не журнал', async () => {
    await assertFails(updateDoc(record(moderator(env)), {reason: 'другая причина'}))
  })

  it('удаление закрыто модератору тоже', async () => {
    await assertFails(deleteDoc(record(moderator(env))))
  })
})
