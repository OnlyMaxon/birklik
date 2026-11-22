import {afterAll, beforeEach, describe, it} from 'vitest'
import {assertFails, assertSucceeds} from '@firebase/rules-unit-testing'
import {doc, getDoc, setDoc, updateDoc, deleteDoc} from 'firebase/firestore'
import {getTestEnv, authed, anon, moderator, OWNER, STRANGER} from './helpers'

const env = await getTestEnv()

// Донесения о том, чем кончилась подача объявления. Пишет их только функция
// `reportClientError` под сервис-аккаунтом — правила её не касаются.
//
// ⚠️ Проверять здесь надо именно то, что выглядит противоречием: донесение
// приходит ОТ клиента, а запись клиенту закрыта. Клиент не пишет сам, он звонит
// функции. Открой запись отсюда — и предел «двадцать в час» перестанет
// существовать, а `uid` в записи станет присланным полем, то есть подделываемым.
const CODE = 'ELAN-7F3K'

const report = () => ({
  code: CODE,
  uid: OWNER,
  owner: OWNER,
  hour: '2026-11-22T20',
  createdAt: '2026-11-22T20:14:09.000Z',
  outcome: 'error',
  flow: 'add-listing',
  step: 'photos',
  source: 'app',
  platform: 'android',
  appVersion: '1.0.15',
  build: '20',
  photosTotal: 12,
  photosDone: 10,
  backgrounded: true,
  errorCode: 'watermark-render-timeout',
  errorMessage: 'снимок не отрисовался',
  appCheck: 'passed'
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'clientErrors', CODE), report())
  })
})

afterAll(async () => {
  await env.cleanup()
})

const record = (ctx: {firestore: () => any}) => doc(ctx.firestore(), 'clientErrors', CODE)

describe('clientErrors: чтение', () => {
  it('модератор читает донесение — по коду, который человек назвал по телефону', async () => {
    await assertSucceeds(getDoc(record(moderator(env))))
  })

  it('САМ пострадавший читать не может: код ему нужен, чтобы назвать, а не чтобы смотреть', async () => {
    await assertFails(getDoc(record(authed(env, OWNER))))
  })

  it('постороннему закрыто — чужой uid и модель телефона не его дело', async () => {
    await assertFails(getDoc(record(authed(env, STRANGER))))
  })

  it('не вошедшему закрыто', async () => {
    await assertFails(getDoc(record(anon(env))))
  })
})

describe('clientErrors: запись закрыта всем, включая того, о ком запись', () => {
  it('ЗАПРЕЩЕНО доносить напрямую, минуя функцию — иначе предела часа нет', async () => {
    await assertFails(
      setDoc(doc(authed(env, OWNER).firestore(), 'clientErrors', 'ELAN-AAAA'), report())
    )
  })

  it('ЗАПРЕЩЕНО не вошедшему: без входа донесения принимает функция, а не правила', async () => {
    await assertFails(
      setDoc(doc(anon(env).firestore(), 'clientErrors', 'ELAN-BBBB'), report())
    )
  })

  it('ЗАПРЕЩЕНО переписывать чужое донесение — подмена разбора', async () => {
    await assertFails(updateDoc(record(authed(env, STRANGER)), {errorCode: 'network'}))
  })

  it('ЗАПРЕЩЕНО и модератору: он разбирает донесения, а не правит их', async () => {
    await assertFails(updateDoc(record(moderator(env)), {errorCode: 'network'}))
  })

  it('ЗАПРЕЩЕНО удалять модератору — срок хранения ведёт политика TTL, а не рука', async () => {
    await assertFails(deleteDoc(record(moderator(env))))
  })
})
