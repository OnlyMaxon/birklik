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
  OWNER,
  STRANGER,
  PROPERTY_ID
} from './helpers'

const env = await getTestEnv()

// Намерение купить — привязка оплаты App Store к объявлению.
//
// ⚠️ Существует потому, что у Apple НЕТ аналога `obfuscatedExternalProfileId`.
// У Google номер объявления хранит сам магазин и возвращает серверу — этим
// закрыта дыра «убили процесс после оплаты, приложение забыло номер, деньги
// списаны, тариф не поставлен». У Apple в квитанцию можно положить только UUID
// (`appAccountToken`), поэтому номер лежит у нас, а в квитанции едет ключ.
//
// Ключ документа — тот самый UUID.
const INTENT_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

const intent = (overrides: Record<string, unknown> = {}) => ({
  userId: OWNER,
  propertyId: PROPERTY_ID,
  productId: 'premium_30',
  createdAt: new Date().toISOString(),
  ...overrides
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'properties', PROPERTY_ID), propertyDoc())
    await setDoc(doc(ctx.firestore(), 'properties', 'other-prop'), propertyDoc({ownerId: STRANGER}))
  })
})

afterAll(async () => {
  await env.cleanup()
})

const record = (ctx: {firestore: () => any}, id = INTENT_ID) =>
  doc(ctx.firestore(), 'purchaseIntents', id)

describe('purchaseIntents: создание', () => {
  it('владелец объявляет намерение купить для своего объявления', async () => {
    await assertSucceeds(setDoc(record(authed(env, OWNER)), intent()))
  })

  it('чужое объявление — отказ, хотя uid свой', async () => {
    // Сервер при выдаче владельца всё равно проверит; это второй слой, и он
    // не даёт засорять базу намерениями на чужие объявления.
    await assertFails(
      setDoc(record(authed(env, OWNER)), intent({propertyId: 'other-prop'}))
    )
  })

  it('нельзя записать намерение от чужого имени', async () => {
    await assertFails(setDoc(record(authed(env, STRANGER)), intent({userId: OWNER})))
  })

  it('без объявления — отказ', async () => {
    await assertFails(setDoc(record(authed(env, OWNER)), intent({propertyId: 42})))
  })

  it('без товара — отказ', async () => {
    await assertFails(setDoc(record(authed(env, OWNER)), intent({productId: null})))
  })

  it('несуществующее объявление — отказ', async () => {
    await assertFails(
      setDoc(record(authed(env, OWNER)), intent({propertyId: 'no-such-property'}))
    )
  })

  it('неизвестный намерений не объявляет', async () => {
    await assertFails(setDoc(record(anon(env)), intent()))
  })

  it('заблокированный намерений не объявляет — платить ему нечего поднимать', async () => {
    await assertFails(setDoc(record(blocked(env, OWNER)), intent()))
  })
})

describe('purchaseIntents: неизменяемость', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'purchaseIntents', INTENT_ID), intent())
    })
  })

  it('переписать намерение нельзя — иначе «номер положен ДО оплаты» теряет смысл', async () => {
    await assertFails(updateDoc(record(authed(env, OWNER)), {propertyId: 'other-prop'}))
  })

  it('удалить намерение нельзя', async () => {
    await assertFails(deleteDoc(record(authed(env, OWNER))))
  })

  it('модератор его тоже не правит', async () => {
    await assertFails(updateDoc(record(moderator(env)), {productId: 'boost_10'}))
  })
})

describe('purchaseIntents: чтение закрыто всем', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'purchaseIntents', INTENT_ID), intent())
    })
  })

  it('даже свой записи человек не читает — из браузера она ему незачем', async () => {
    await assertFails(getDoc(record(authed(env, OWNER))))
  })

  it('посторонний не читает', async () => {
    await assertFails(getDoc(record(authed(env, STRANGER))))
  })

  it('модератор не читает', async () => {
    await assertFails(getDoc(record(moderator(env))))
  })
})
