import {beforeEach, describe, expect, it, vi} from 'vitest'

// server-only бросает исключение вне серверного окружения Next — в тестах он не нужен.
vi.mock('server-only', () => ({}))

// Подписью и токенами занимается google-auth, здесь проверяется только формат запросов.
vi.mock('./google-auth', () => ({
  getAccessToken: vi.fn(async () => 'test-token'),
  getServiceAccount: vi.fn(() => ({
    projectId: 'test-project',
    clientEmail: 'sa@test.iam.gserviceaccount.com',
    privateKey: 'unused'
  }))
}))

import {
  getDoc,
  queryDocs,
  setDoc,
  updateDoc,
  addDoc,
  runTransaction,
  increment,
  arrayUnion,
  arrayRemove,
  generateDocumentId,
  DOCUMENT_ID,
  FirestoreError
} from './firestore-rest'

const DOCS = 'projects/test-project/databases/(default)/documents'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

/** Ответ Firestore в том виде, в каком его читает клиент. */
function respond(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  }
}

/** Тело запроса, разобранное обратно из JSON. */
function requestBody(callIndex = 0) {
  return JSON.parse(fetchMock.mock.calls[callIndex][1].body as string)
}

function requestUrl(callIndex = 0) {
  return fetchMock.mock.calls[callIndex][0] as string
}

beforeEach(() => {
  fetchMock.mockReset()
})

describe('кодирование значений', () => {
  it('различает целые и дробные числа', async () => {
    fetchMock.mockResolvedValue(respond({}))
    await setDoc('properties', 'p1', {views: 42, rating: 4.5})

    const fields = requestBody().writes[0].update.fields
    // Целые Firestore принимает строкой, иначе теряется точность на больших значениях.
    expect(fields.views).toEqual({integerValue: '42'})
    expect(fields.rating).toEqual({doubleValue: 4.5})
  })

  it('кодирует строки, флаги, null и вложенные структуры', async () => {
    fetchMock.mockResolvedValue(respond({}))
    await setDoc('properties', 'p1', {
      title: 'Дом',
      isActive: true,
      expiredAt: null,
      price: {daily: 100, currency: 'AZN'},
      images: ['a.webp', 'b.webp']
    })

    const fields = requestBody().writes[0].update.fields
    expect(fields.title).toEqual({stringValue: 'Дом'})
    expect(fields.isActive).toEqual({booleanValue: true})
    expect(fields.expiredAt).toEqual({nullValue: null})
    expect(fields.price).toEqual({
      mapValue: {fields: {daily: {integerValue: '100'}, currency: {stringValue: 'AZN'}}}
    })
    expect(fields.images).toEqual({
      arrayValue: {values: [{stringValue: 'a.webp'}, {stringValue: 'b.webp'}]}
    })
  })

  it('пропускает undefined вместо того чтобы падать', async () => {
    fetchMock.mockResolvedValue(respond({}))
    await setDoc('properties', 'p1', {title: 'Дом', city: undefined})

    const fields = requestBody().writes[0].update.fields
    expect(fields).toHaveProperty('title')
    expect(fields).not.toHaveProperty('city')
  })

  it('переводит Date в timestamp', async () => {
    fetchMock.mockResolvedValue(respond({}))
    await setDoc('properties', 'p1', {createdAt: new Date('2026-08-23T10:00:00.000Z')})

    expect(requestBody().writes[0].update.fields.createdAt).toEqual({
      timestampValue: '2026-08-23T10:00:00.000Z'
    })
  })
})

describe('декодирование ответа', () => {
  it('возвращает документ как {id, ...поля} и разворачивает вложенное', async () => {
    fetchMock.mockResolvedValue(
      respond({
        name: `${DOCS}/properties/abc123`,
        fields: {
          title: {stringValue: 'Дом'},
          views: {integerValue: '7'},
          rating: {doubleValue: 4.5},
          isActive: {booleanValue: true},
          expiredAt: {nullValue: null},
          price: {mapValue: {fields: {daily: {integerValue: '100'}}}},
          images: {arrayValue: {values: [{stringValue: 'a.webp'}]}}
        }
      })
    )

    const doc = await getDoc<Record<string, unknown>>('properties', 'abc123')

    expect(doc).toEqual({
      id: 'abc123',
      title: 'Дом',
      views: 7,
      rating: 4.5,
      isActive: true,
      expiredAt: null,
      price: {daily: 100},
      images: ['a.webp']
    })
  })

  it('отдаёт null, когда документа нет, а не бросает исключение', async () => {
    fetchMock.mockResolvedValue(respond({error: 'not found'}, 404))
    await expect(getDoc('properties', 'missing')).resolves.toBeNull()
  })

  it('пробрасывает прочие ошибки Firestore', async () => {
    fetchMock.mockResolvedValue(respond({error: 'denied'}, 403))
    await expect(getDoc('properties', 'x')).rejects.toBeInstanceOf(FirestoreError)
  })
})

describe('сборка запроса', () => {
  beforeEach(() => fetchMock.mockResolvedValue(respond([])))

  it('единственный фильтр кладёт без композита', async () => {
    await queryDocs('properties', {where: [['status', '==', 'active']]})

    const query = requestBody().structuredQuery
    expect(query.from).toEqual([{collectionId: 'properties'}])
    expect(query.where).toEqual({
      fieldFilter: {field: {fieldPath: 'status'}, op: 'EQUAL', value: {stringValue: 'active'}}
    })
  })

  it('несколько фильтров объединяет через AND и понимает in', async () => {
    await queryDocs('properties', {
      where: [
        ['status', '==', 'active'],
        ['listingTier', 'in', ['vip', 'premium']]
      ]
    })

    const where = requestBody().structuredQuery.where
    expect(where.compositeFilter.op).toBe('AND')
    expect(where.compositeFilter.filters).toHaveLength(2)
    expect(where.compositeFilter.filters[1].fieldFilter.op).toBe('IN')
    expect(where.compositeFilter.filters[1].fieldFilter.value).toEqual({
      arrayValue: {values: [{stringValue: 'vip'}, {stringValue: 'premium'}]}
    })
  })

  it('курсор по идентификатору документа передаёт ссылкой, а не строкой', async () => {
    await queryDocs('properties', {
      orderBy: [
        ['createdAt', 'desc'],
        [DOCUMENT_ID, 'desc']
      ],
      startAfter: ['2026-08-01T00:00:00.000Z', 'abc123'],
      limit: 21
    })

    const query = requestBody().structuredQuery
    expect(query.orderBy).toEqual([
      {field: {fieldPath: 'createdAt'}, direction: 'DESCENDING'},
      {field: {fieldPath: '__name__'}, direction: 'DESCENDING'}
    ])
    // Идентификатор документа Firestore принимает только полным путём.
    expect(query.startAt).toEqual({
      values: [
        {stringValue: '2026-08-01T00:00:00.000Z'},
        {referenceValue: `${DOCS}/properties/abc123`}
      ],
      before: false
    })
    expect(query.limit).toBe(21)
  })

  it('фильтр по идентификатору документа тоже становится ссылкой', async () => {
    await queryDocs('properties', {where: [[DOCUMENT_ID, '==', 'abc123']]})

    expect(requestBody().structuredQuery.where.fieldFilter.value).toEqual({
      referenceValue: `${DOCS}/properties/abc123`
    })
  })

  it('выборка полей уходит в select', async () => {
    await queryDocs('properties', {select: ['updatedAt', 'createdAt']})

    expect(requestBody().structuredQuery.select).toEqual({
      fields: [{fieldPath: 'updatedAt'}, {fieldPath: 'createdAt'}]
    })
  })

  it('для вложенной коллекции родителем берёт документ, а не корень', async () => {
    await queryDocs('users/uid-1/notifications', {limit: 5})

    expect(requestUrl()).toContain(`${DOCS}/users/uid-1:runQuery`)
    expect(requestBody().structuredQuery.from).toEqual([{collectionId: 'notifications'}])
  })

  it('строки без документа отбрасывает', async () => {
    fetchMock.mockResolvedValue(
      respond([
        {readTime: '2026-08-23T00:00:00Z'},
        {document: {name: `${DOCS}/properties/a`, fields: {title: {stringValue: 'Дом'}}}},
        {skippedResults: 3}
      ])
    )

    const rows = await queryDocs<{title: string}>('properties', {})
    expect(rows).toEqual([{id: 'a', title: 'Дом'}])
  })
})

describe('запись и трансформы', () => {
  beforeEach(() => fetchMock.mockResolvedValue(respond({})))

  it('updateDoc ограничивает запись маской полей', async () => {
    await updateDoc('properties', 'p1', {title: 'Новый', updatedAt: '2026-08-23'})

    const write = requestBody().writes[0]
    expect(write.updateMask).toEqual({fieldPaths: ['title', 'updatedAt']})
  })

  it('setDoc пишет документ целиком, без маски', async () => {
    await setDoc('properties', 'p1', {title: 'Новый'})

    expect(requestBody().writes[0]).not.toHaveProperty('updateMask')
  })

  it('increment уходит в updateTransforms, а не в поля', async () => {
    await updateDoc('properties', 'p1', {views: increment(1)})

    const write = requestBody().writes[0]
    expect(write.update.fields).toEqual({})
    expect(write.updateMask).toEqual({fieldPaths: []})
    expect(write.updateTransforms).toEqual([{fieldPath: 'views', increment: {integerValue: '1'}}])
  })

  it('arrayUnion и arrayRemove кодируются своими операциями', async () => {
    await updateDoc('properties', 'p1', {favorites: arrayUnion('uid-1')})
    expect(requestBody(0).writes[0].updateTransforms).toEqual([
      {fieldPath: 'favorites', appendMissingElements: {values: [{stringValue: 'uid-1'}]}}
    ])

    fetchMock.mockClear()
    await updateDoc('properties', 'p1', {favorites: arrayRemove('uid-1')})
    expect(requestBody(0).writes[0].updateTransforms).toEqual([
      {fieldPath: 'favorites', removeAllFromArray: {values: [{stringValue: 'uid-1'}]}}
    ])
  })

  it('обычные поля и трансформы едут одним write, то есть применяются вместе', async () => {
    await updateDoc('properties', 'p1', {updatedAt: '2026-08-23', views: increment(1)})

    const writes = requestBody().writes
    expect(writes).toHaveLength(1)
    expect(writes[0].update.fields).toEqual({updatedAt: {stringValue: '2026-08-23'}})
    expect(writes[0].updateMask).toEqual({fieldPaths: ['updatedAt']})
    expect(writes[0].updateTransforms).toHaveLength(1)
  })

  it('addDoc отправляет POST в коллекцию и возвращает выданный идентификатор', async () => {
    fetchMock.mockResolvedValue(respond({name: `${DOCS}/bookings/generated-id`}))

    const id = await addDoc('bookings', {status: 'pending'})

    expect(id).toBe('generated-id')
    expect(requestUrl()).toContain(`${DOCS}/bookings`)
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
  })
})

describe('транзакции', () => {
  it('открывает транзакцию, читает внутри неё и коммитит одним пакетом', async () => {
    fetchMock
      .mockResolvedValueOnce(respond({transaction: 'tx-1'}))
      .mockResolvedValueOnce(respond([]))
      .mockResolvedValueOnce(respond({}))

    const result = await runTransaction(async transaction => {
      await transaction.query('bookings', {where: [['propertyId', '==', 'p1']]})
      transaction.set('bookings', 'b1', {status: 'pending'})
      return 'готово'
    })

    expect(result).toBe('готово')
    expect(requestUrl(0)).toContain(':beginTransaction')
    // Чтение обязано идти с идентификатором транзакции, иначе оно вне снапшота.
    expect(requestBody(1).transaction).toBe('tx-1')
    expect(requestUrl(2)).toContain(':commit')
    expect(requestBody(2).transaction).toBe('tx-1')
    expect(requestBody(2).writes).toHaveLength(1)
  })

  it('при ошибке внутри откатывает и не коммитит', async () => {
    fetchMock
      .mockResolvedValueOnce(respond({transaction: 'tx-2'}))
      .mockResolvedValueOnce(respond({}))

    await expect(
      runTransaction(async () => {
        throw new Error('конфликт дат')
      })
    ).rejects.toThrow('конфликт дат')

    const urls = fetchMock.mock.calls.map(call => call[0] as string)
    expect(urls.some(url => url.includes(':rollback'))).toBe(true)
    expect(urls.some(url => url.includes(':commit'))).toBe(false)
  })
})

describe('generateDocumentId', () => {
  it('выдаёт 20 символов из алфавита Firestore и не повторяется', () => {
    const ids = new Set(Array.from({length: 200}, () => generateDocumentId()))

    expect(ids.size).toBe(200)
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9]{20}$/)
  })
})
