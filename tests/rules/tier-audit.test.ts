import {afterAll, beforeEach, describe, it} from 'vitest'
import {assertFails, assertSucceeds} from '@firebase/rules-unit-testing'
import {doc, getDoc, setDoc, updateDoc, deleteDoc} from 'firebase/firestore'
import {getTestEnv, authed, anon, moderator, OWNER, STRANGER, PROPERTY_ID} from './helpers'

const env = await getTestEnv()

// Журнал изменений тарифа и подъёма. Пишет его только триггер
// `auditTierChanges` под сервис-аккаунтом, поэтому из правил запись закрыта
// ВСЕМ — журнал, который можно подправить, не журнал.
const ENTRY_ID = 'audit-1'

const entry = () => ({
  propertyId: PROPERTY_ID,
  fields: ['listingTier', 'premiumExpiresAt'],
  was: {listingTier: 'standard', premiumExpiresAt: null},
  now: {listingTier: 'premium', premiumExpiresAt: '2026-11-15T23:59:59.000Z'},
  source: 'РУКАМИ',
  author: 'some-moderator-uid',
  ownerId: OWNER,
  at: new Date().toISOString()
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'tierAudit', ENTRY_ID), entry())
  })
})

afterAll(async () => {
  await env.cleanup()
})

const record = (ctx: {firestore: () => any}) => doc(ctx.firestore(), 'tierAudit', ENTRY_ID)

describe('tierAudit: чтение', () => {
  it('модератор читает журнал — разбирать «кто дал Premium» будет он', async () => {
    await assertSucceeds(getDoc(record(moderator(env))))
  })

  it('владельцу объявления журнал закрыт', async () => {
    await assertFails(getDoc(record(authed(env, OWNER))))
  })

  it('постороннему закрыт', async () => {
    await assertFails(getDoc(record(authed(env, STRANGER))))
  })

  it('не вошедшему закрыт', async () => {
    await assertFails(getDoc(record(anon(env))))
  })
})

describe('tierAudit: запись закрыта всем', () => {
  it('ЗАПРЕЩЕНО дописывать запись даже модератору', async () => {
    await assertFails(
      setDoc(doc(moderator(env).firestore(), 'tierAudit', 'подделка'), entry())
    )
  })

  it('ЗАПРЕЩЕНО править запись модератору — иначе журнал не доказательство', async () => {
    await assertFails(updateDoc(record(moderator(env)), {source: 'оплата'}))
  })

  it('ЗАПРЕЩЕНО удалять запись модератору', async () => {
    await assertFails(deleteDoc(record(moderator(env))))
  })

  it('ЗАПРЕЩЕНО владельцу писать что угодно', async () => {
    await assertFails(setDoc(doc(authed(env, OWNER).firestore(), 'tierAudit', 'своё'), entry()))
  })
})
