import {afterAll, beforeEach, describe, it} from 'vitest'
import {assertFails, assertSucceeds} from '@firebase/rules-unit-testing'
import {doc, getDoc, setDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove} from 'firebase/firestore'
import {
  getTestEnv, authed, anon, moderator,
  OWNER, GUEST, STRANGER, PROPERTY_ID, propertyDoc
} from './helpers'

const env = await getTestEnv()

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'properties', PROPERTY_ID), propertyDoc())
  })
})

afterAll(async () => {
  await env.cleanup()
})

const property = (ctx: {firestore: () => any}) => doc(ctx.firestore(), 'properties', PROPERTY_ID)

describe('properties: чтение', () => {
  it('объявление читает кто угодно, даже не вошедший', async () => {
    await assertSucceeds(getDoc(property(anon(env))))
  })
})

describe('properties: избранное', () => {
  // Главный сценарий, ради которого правила и переписывались: ветка «любой
  // вошедший» сжата до одной собственной отметки. Раньше она пропускала запись
  // views, likes, comments, ratings и reviews на ЧУЖОМ объявлении.
  it('вошедший ставит СВОЙ uid в избранное', async () => {
    await assertSucceeds(
      updateDoc(property(authed(env, STRANGER)), {favorites: [STRANGER]})
    )
  })

  it('снимает свою отметку обратно', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'properties', PROPERTY_ID), propertyDoc({favorites: [STRANGER]}))
    })
    await assertSucceeds(
      updateDoc(property(authed(env, STRANGER)), {favorites: []})
    )
  })

  it('повторный клик без изменений не отклоняется', async () => {
    await assertSucceeds(
      updateDoc(property(authed(env, STRANGER)), {favorites: []})
    )
  })

  it('не трогает чужие отметки, добавляя свою', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'properties', PROPERTY_ID), propertyDoc({favorites: [GUEST]}))
    })
    await assertSucceeds(
      updateDoc(property(authed(env, STRANGER)), {favorites: [GUEST, STRANGER]})
    )
  })

  it('ЗАПРЕЩЕНО добавлять чужой uid', async () => {
    await assertFails(
      updateDoc(property(authed(env, STRANGER)), {favorites: [GUEST]})
    )
  })

  it('ЗАПРЕЩЕНО вычищать чужие отметки', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'properties', PROPERTY_ID), propertyDoc({favorites: [GUEST, STRANGER]}))
    })
    await assertFails(
      updateDoc(property(authed(env, STRANGER)), {favorites: [STRANGER]})
    )
  })

  it('ЗАПРЕЩЕНО невошедшему', async () => {
    await assertFails(
      updateDoc(property(anon(env)), {favorites: ['anyone']})
    )
  })

  it('ЗАПРЕЩЕНО провозить лишнее поле вместе с избранным', async () => {
    await assertFails(
      updateDoc(property(authed(env, STRANGER)), {favorites: [STRANGER], views: 9999})
    )
  })
})

// Проверки выше писали массив целиком, а рабочий код и на сайте, и в
// приложении пользуется arrayUnion/arrayRemove. Это ДРУГОЙ путь: значение
// вычисляет сервер, и правила видят документ уже после преобразования.
// Без этих проверок правила считались бы протестированными, а боевой сценарий
// оставался бы не покрытым ни одним тестом.
describe('properties: избранное через arrayUnion и arrayRemove', () => {
  it('добавляет себя', async () => {
    await assertSucceeds(
      updateDoc(property(authed(env, STRANGER)), {favorites: arrayUnion(STRANGER)})
    )
  })

  it('убирает себя', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'properties', PROPERTY_ID), propertyDoc({favorites: [STRANGER]}))
    })
    await assertSucceeds(
      updateDoc(property(authed(env, STRANGER)), {favorites: arrayRemove(STRANGER)})
    )
  })

  it('добавляет себя, не трогая чужие отметки', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'properties', PROPERTY_ID), propertyDoc({favorites: [GUEST]}))
    })
    await assertSucceeds(
      updateDoc(property(authed(env, STRANGER)), {favorites: arrayUnion(STRANGER)})
    )
  })

  it('повторное добавление себя не отклоняется', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'properties', PROPERTY_ID), propertyDoc({favorites: [STRANGER]}))
    })
    await assertSucceeds(
      updateDoc(property(authed(env, STRANGER)), {favorites: arrayUnion(STRANGER)})
    )
  })

  it('ЗАПРЕЩЕНО добавлять чужой uid', async () => {
    await assertFails(
      updateDoc(property(authed(env, STRANGER)), {favorites: arrayUnion(GUEST)})
    )
  })

  it('ЗАПРЕЩЕНО убирать чужой uid', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'properties', PROPERTY_ID), propertyDoc({favorites: [GUEST, STRANGER]}))
    })
    await assertFails(
      updateDoc(property(authed(env, STRANGER)), {favorites: arrayRemove(GUEST)})
    )
  })

  it('ЗАПРЕЩЕНО невошедшему', async () => {
    await assertFails(updateDoc(property(anon(env)), {favorites: arrayUnion('anyone')}))
  })
})

describe('properties: дыры, закрытые аудитом', () => {
  it('ЗАПРЕЩЕНО накручивать просмотры на чужом объявлении', async () => {
    await assertFails(updateDoc(property(authed(env, STRANGER)), {views: 9999}))
  })

  it('ЗАПРЕЩЕНО ставить оценку на чужом объявлении', async () => {
    await assertFails(
      updateDoc(property(authed(env, STRANGER)), {rating: 5, ratings: [{userId: STRANGER, value: 5}]})
    )
  })

  it('ЗАПРЕЩЕНО переписывать комментарии на чужом объявлении', async () => {
    await assertFails(
      updateDoc(property(authed(env, STRANGER)), {comments: [{text: 'подделка'}]})
    )
  })
})

describe('properties: владелец', () => {
  it('правит своё описание', async () => {
    await assertSucceeds(updateDoc(property(authed(env, OWNER)), {title: 'Новое название'}))
  })

  it('ЗАПРЕЩЕНО менять себе тариф', async () => {
    await assertFails(updateDoc(property(authed(env, OWNER)), {listingTier: 'premium'}))
  })

  it('ЗАПРЕЩЕНО выдавать себе срок премиума', async () => {
    await assertFails(updateDoc(property(authed(env, OWNER)), {premiumExpiresAt: '2030-01-01'}))
  })

  it('ЗАПРЕЩЕНО самому себя промодерировать', async () => {
    // Объявление должно лежать НЕ в целевом статусе, иначе запись не меняет
    // ничего и `affectedKeys()` пуст: одинаковое значение полем изменённым не
    // считается, и правило справедливо пропускает такую запись.
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'properties', PROPERTY_ID), propertyDoc({status: 'pending'}))
    })
    await assertFails(updateDoc(property(authed(env, OWNER)), {status: 'active'}))
  })

  it('ЗАПРЕЩЕНО поднимать себя в избранные площадки', async () => {
    await assertFails(updateDoc(property(authed(env, OWNER)), {isFeatured: true}))
  })

  it('удаляет своё объявление', async () => {
    await assertSucceeds(deleteDoc(property(authed(env, OWNER))))
  })

  it('ЗАПРЕЩЕНО удалять чужое', async () => {
    await assertFails(deleteDoc(property(authed(env, STRANGER))))
  })
})

describe('properties: модератор', () => {
  it('меняет статус', async () => {
    await assertSucceeds(updateDoc(property(moderator(env)), {status: 'rejected'}))
  })

  it('удаляет любое объявление', async () => {
    await assertSucceeds(deleteDoc(property(moderator(env))))
  })
})

describe('properties: создание', () => {
  const newProperty = (ctx: {firestore: () => any}) => doc(ctx.firestore(), 'properties', 'new-prop')

  it('обычное объявление создаётся со статусом pending', async () => {
    await assertSucceeds(
      setDoc(newProperty(authed(env, GUEST)), propertyDoc({
        ownerId: GUEST, listingTier: 'standard', status: 'pending'
      }))
    )
  })

  it('платное создаётся черновиком', async () => {
    await assertSucceeds(
      setDoc(newProperty(authed(env, GUEST)), propertyDoc({
        ownerId: GUEST, listingTier: 'premium', status: 'draft'
      }))
    )
  })

  it('ЗАПРЕЩЕНО создать платное сразу активным', async () => {
    await assertFails(
      setDoc(newProperty(authed(env, GUEST)), propertyDoc({
        ownerId: GUEST, listingTier: 'premium', status: 'active'
      }))
    )
  })

  it('ЗАПРЕЩЕНО принести свой срок премиума', async () => {
    await assertFails(
      setDoc(newProperty(authed(env, GUEST)), propertyDoc({
        ownerId: GUEST, listingTier: 'premium', status: 'draft', premiumExpiresAt: '2030-01-01'
      }))
    )
  })

  it('ЗАПРЕЩЕНО создавать объявление от чужого имени', async () => {
    await assertFails(
      setDoc(newProperty(authed(env, GUEST)), propertyDoc({
        ownerId: OWNER, listingTier: 'standard', status: 'pending'
      }))
    )
  })
})
