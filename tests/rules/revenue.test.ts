import {afterAll, beforeEach, describe, it} from 'vitest'
import {assertFails, assertSucceeds} from '@firebase/rules-unit-testing'
import {doc, getDoc, setDoc, updateDoc, deleteDoc} from 'firebase/firestore'
import {getTestEnv, authed, anon, moderator, OWNER, STRANGER} from './helpers'

const env = await getTestEnv()

// Счётчик выручки по месяцам. Собирает его триггер `recordRevenue` под
// сервис-аккаунтом, поэтому из правил запись закрыта ВСЕМ: месячный итог,
// который можно выставить рукой, не считается ни с чем и ничего не доказывает.
const MONTH = '2026-11'

const month = () => ({
  month: MONTH,
  usdRate: 1.7,
  count: 3,
  grossAzn: 92,
  gross: {AZN: 75, USD: 10},
  byProviderAzn: {azericard: 75, app_store: 17},
  byKindAzn: {tier: 85, boost: 7},
  countByProvider: {azericard: 2, app_store: 1},
  refundedAzn: 0,
  refundCount: 0
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'revenue', MONTH), month())
  })
})

afterAll(async () => {
  await env.cleanup()
})

const record = (ctx: {firestore: () => any}) => doc(ctx.firestore(), 'revenue', MONTH)

describe('revenue: чтение', () => {
  it('модератор читает выручку — вкладка в модераторке ради этого и сделана', async () => {
    await assertSucceeds(getDoc(record(moderator(env))))
  })

  it('обычному вошедшему закрыто — оборот площадки не его дело', async () => {
    await assertFails(getDoc(record(authed(env, OWNER))))
  })

  it('постороннему закрыто', async () => {
    await assertFails(getDoc(record(authed(env, STRANGER))))
  })

  it('не вошедшему закрыто', async () => {
    await assertFails(getDoc(record(anon(env))))
  })
})

describe('revenue: запись закрыта всем', () => {
  it('ЗАПРЕЩЕНО заводить месяц даже модератору', async () => {
    await assertFails(setDoc(doc(moderator(env).firestore(), 'revenue', '2026-12'), month()))
  })

  it('ЗАПРЕЩЕНО дописывать итог модератору — иначе число не из платежей', async () => {
    await assertFails(updateDoc(record(moderator(env)), {grossAzn: 1000}))
  })

  it('ЗАПРЕЩЕНО удалять месяц модератору', async () => {
    await assertFails(deleteDoc(record(moderator(env))))
  })

  it('ЗАПРЕЩЕНО владельцу писать что угодно', async () => {
    await assertFails(setDoc(doc(authed(env, OWNER).firestore(), 'revenue', 'своё'), month()))
  })
})
