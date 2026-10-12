import {afterAll, beforeEach, describe, it} from 'vitest'
import {assertFails, assertSucceeds} from '@firebase/rules-unit-testing'
import {doc, getDoc, setDoc, updateDoc, deleteDoc} from 'firebase/firestore'
import {getTestEnv, authed, anon, moderator, OWNER, STRANGER, PROPERTY_ID} from './helpers'

const env = await getTestEnv()

// Счётчик незаконченного пакета подъёмов. Это кошелёк: по нему ночная задача
// раздаёт оплаченные подъёмы. Пишет его только сервер под сервис-аккаунтом,
// поэтому из правил запись закрыта ВСЕМ — владельцу и модератору тоже.
const boostRecord = () => ({
  propertyId: PROPERTY_ID,
  ownerId: OWNER,
  remaining: 9,
  total: 10,
  source: 'azericard',
  lastBumpAt: new Date().toISOString()
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'boosts', PROPERTY_ID), boostRecord())
  })
})

afterAll(async () => {
  await env.cleanup()
})

const record = (ctx: {firestore: () => any}) => doc(ctx.firestore(), 'boosts', PROPERTY_ID)

describe('boosts: чтение', () => {
  it('вошедший читает запись — экран показывает остаток подъёмов', async () => {
    await assertSucceeds(getDoc(record(authed(env, OWNER))))
  })

  it('не вошедшему читать нечего', async () => {
    await assertFails(getDoc(record(anon(env))))
  })
})

describe('boosts: запись закрыта всем', () => {
  it('ЗАПРЕЩЕНО владельцу выдать себе подъёмы', async () => {
    await assertFails(updateDoc(record(authed(env, OWNER)), {remaining: 999}))
  })

  it('ЗАПРЕЩЕНО владельцу создать запись с нуля', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await deleteDoc(doc(ctx.firestore(), 'boosts', PROPERTY_ID))
    })
    await assertFails(setDoc(record(authed(env, OWNER)), boostRecord()))
  })

  it('ЗАПРЕЩЕНО постороннему тронуть чужой пакет', async () => {
    await assertFails(updateDoc(record(authed(env, STRANGER)), {remaining: 0}))
  })

  it('ЗАПРЕЩЕНО даже модератору — счётчик ставит только оплата', async () => {
    await assertFails(updateDoc(record(moderator(env)), {remaining: 50}))
  })

  it('ЗАПРЕЩЕНО удалять запись, чтобы не потерять оплаченное', async () => {
    await assertFails(deleteDoc(record(authed(env, OWNER))))
  })
})
