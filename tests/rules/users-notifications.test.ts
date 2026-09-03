import {afterAll, beforeEach, describe, it} from 'vitest'
import {assertFails, assertSucceeds} from '@firebase/rules-unit-testing'
import {doc, setDoc, updateDoc, getDoc} from 'firebase/firestore'
import {getTestEnv, authed, anon, moderator, OWNER, GUEST, STRANGER} from './helpers'

const env = await getTestEnv()

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', OWNER), {name: 'Owner', phone: '+994500000000', moderator: false})
    await setDoc(doc(db, 'users', OWNER, 'notifications', 'n1'), {
      userId: OWNER, type: 'booking', message: 'Новая заявка', read: false
    })
  })
})

afterAll(async () => {
  await env.cleanup()
})

describe('users: профиль', () => {
  it('читает свой профиль', async () => {
    await assertSucceeds(getDoc(doc(authed(env, OWNER).firestore(), 'users', OWNER)))
  })

  // Телефон владельца лежит здесь, поэтому чужой профиль закрыт наглухо.
  it('ЗАПРЕЩЕНО читать чужой профиль', async () => {
    await assertFails(getDoc(doc(authed(env, STRANGER).firestore(), 'users', OWNER)))
  })

  it('модератор читает любой профиль', async () => {
    await assertSucceeds(getDoc(doc(moderator(env).firestore(), 'users', OWNER)))
  })

  it('ЗАПРЕЩЕНО невошедшему', async () => {
    await assertFails(getDoc(doc(anon(env).firestore(), 'users', OWNER)))
  })

  it('правит своё имя', async () => {
    await assertSucceeds(updateDoc(doc(authed(env, OWNER).firestore(), 'users', OWNER), {name: 'Новое'}))
  })

  it('ЗАПРЕЩЕНО выдавать себе модератора', async () => {
    await assertFails(updateDoc(doc(authed(env, OWNER).firestore(), 'users', OWNER), {moderator: true}))
  })

  it('ЗАПРЕЩЕНО выдавать себе админа', async () => {
    await assertFails(updateDoc(doc(authed(env, OWNER).firestore(), 'users', OWNER), {admin: true}))
  })

  // Найдено этими же тестами 2026-09-03. По полю isModerator сервер решает, кому
  // разослать жалобы на комментарии, а в уведомление уходит имя пожаловавшегося.
  // Правило стерегло только 'moderator' и 'admin' — полей, которых нет ни у кого
  // из 140 боевых пользователей, — а настоящее поле пропускало.
  it('ЗАПРЕЩЕНО выписывать себе isModerator', async () => {
    await assertFails(
      updateDoc(doc(authed(env, OWNER).firestore(), 'users', OWNER), {isModerator: true})
    )
  })

  it('ЗАПРЕЩЕНО принести isModerator при регистрации', async () => {
    await assertFails(
      setDoc(doc(authed(env, STRANGER).firestore(), 'users', STRANGER), {
        name: 'Новичок', isModerator: true
      })
    )
  })

  it('обычная регистрация проходит', async () => {
    await assertSucceeds(
      setDoc(doc(authed(env, STRANGER).firestore(), 'users', STRANGER), {name: 'Новичок'})
    )
  })

  // Из-за keys() вместо diff().affectedKeys() пользователь с уже проставленным
  // полем не мог поправить даже собственное имя.
  it('модератор правит своё имя, не теряя признак', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'users', GUEST), {name: 'Мод', isModerator: true})
    })
    await assertSucceeds(
      updateDoc(doc(authed(env, GUEST).firestore(), 'users', GUEST), {name: 'Мод 2'})
    )
  })

  it('ЗАПРЕЩЕНО снимать признак у себя же тем более менять', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'users', GUEST), {name: 'Мод', isModerator: true})
    })
    await assertFails(
      updateDoc(doc(authed(env, GUEST).firestore(), 'users', GUEST), {isModerator: false})
    )
  })
})

describe('users: уведомления', () => {
  const target = (uid: string, id = 'n2') => (ctx: {firestore: () => any}) =>
    doc(ctx.firestore(), 'users', uid, 'notifications', id)

  it('читает свои уведомления', async () => {
    await assertSucceeds(getDoc(doc(authed(env, OWNER).firestore(), 'users', OWNER, 'notifications', 'n1')))
  })

  it('ЗАПРЕЩЕНО читать чужие уведомления', async () => {
    await assertFails(getDoc(doc(authed(env, STRANGER).firestore(), 'users', OWNER, 'notifications', 'n1')))
  })

  // Писать в чужую подколлекцию разрешено намеренно: гость уведомляет владельца
  // о новой брони. Но адресат обязан совпадать с путём документа.
  it('гость кладёт уведомление владельцу', async () => {
    await assertSucceeds(
      setDoc(target(OWNER)(authed(env, GUEST)), {
        userId: OWNER, type: 'booking', message: 'Новая заявка', read: false
      })
    )
  })

  it('ЗАПРЕЩЕНО подменять адресата в теле документа', async () => {
    await assertFails(
      setDoc(target(OWNER)(authed(env, GUEST)), {
        userId: GUEST, type: 'booking', message: 'Подделка', read: false
      })
    )
  })

  it('ЗАПРЕЩЕНО класть сразу прочитанное', async () => {
    await assertFails(
      setDoc(target(OWNER)(authed(env, GUEST)), {
        userId: OWNER, type: 'booking', message: 'Заявка', read: true
      })
    )
  })

  it('помечает своё уведомление прочитанным', async () => {
    await assertSucceeds(
      updateDoc(doc(authed(env, OWNER).firestore(), 'users', OWNER, 'notifications', 'n1'), {read: true})
    )
  })

  it('ЗАПРЕЩЕНО помечать чужое', async () => {
    await assertFails(
      updateDoc(doc(authed(env, STRANGER).firestore(), 'users', OWNER, 'notifications', 'n1'), {read: true})
    )
  })
})
