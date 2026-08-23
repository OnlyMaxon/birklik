import 'server-only'
import {getAccessToken, getServiceAccount} from './google-auth'

// Клиент Firestore поверх REST API.
//
// Заменяет @google-cloud/firestore из Admin SDK: тот строит клиента через
// protobufjs, который генерирует код из строк, а Cloudflare Workers это
// запрещают. REST-эндпоинты Firestore обычные HTTPS, их достаточно позвать
// через fetch.
//
// Документация формата: https://firebase.google.com/docs/firestore/reference/rest

const FIRESTORE_HOST = 'https://firestore.googleapis.com/v1'

function databaseRoot(): string {
  const {projectId} = getServiceAccount()
  return `projects/${projectId}/databases/(default)`
}

function documentsRoot(): string {
  return `${databaseRoot()}/documents`
}

/** Значение поля в формате Firestore REST. */
type FirestoreValue = Record<string, unknown>

/** Документ Firestore в формате REST. */
interface FirestoreDocument {
  name: string
  fields?: Record<string, FirestoreValue>
  createTime?: string
  updateTime?: string
}

// --- Трансформы полей -------------------------------------------------------
// Сентинелы вместо FieldValue из Admin SDK. Обычным PATCH такое не выразить,
// поэтому updateDoc отправляет их отдельным списком updateTransforms в :commit.

const TRANSFORM = Symbol('firestore-transform')

interface FieldTransformSentinel {
  [TRANSFORM]: true
  build: (fieldPath: string) => Record<string, unknown>
}

function isTransform(value: unknown): value is FieldTransformSentinel {
  return typeof value === 'object' && value !== null && TRANSFORM in value
}

export function increment(by: number): unknown {
  return {
    [TRANSFORM]: true,
    build: (fieldPath: string) => ({fieldPath, increment: encodeValue(by)})
  } satisfies FieldTransformSentinel
}

export function arrayUnion(...elements: unknown[]): unknown {
  return {
    [TRANSFORM]: true,
    build: (fieldPath: string) => ({
      fieldPath,
      appendMissingElements: {values: elements.map(encodeValue)}
    })
  } satisfies FieldTransformSentinel
}

export function arrayRemove(...elements: unknown[]): unknown {
  return {
    [TRANSFORM]: true,
    build: (fieldPath: string) => ({
      fieldPath,
      removeAllFromArray: {values: elements.map(encodeValue)}
    })
  } satisfies FieldTransformSentinel
}

// --- Кодирование и декодирование значений -----------------------------------

function encodeValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return {nullValue: null}
  if (typeof value === 'string') return {stringValue: value}
  if (typeof value === 'boolean') return {booleanValue: value}
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return {doubleValue: value}
    // Firestore различает целые и дробные; целые передаются строкой, чтобы не
    // терять точность на больших значениях.
    return Number.isInteger(value) ? {integerValue: String(value)} : {doubleValue: value}
  }
  if (value instanceof Date) return {timestampValue: value.toISOString()}
  if (Array.isArray(value)) return {arrayValue: {values: value.map(encodeValue)}}
  if (typeof value === 'object') return {mapValue: {fields: encodeFields(value as Record<string, unknown>)}}

  throw new TypeError(`Firestore: неподдерживаемый тип значения ${typeof value}`)
}

function encodeFields(data: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {}
  for (const [key, value] of Object.entries(data)) {
    // undefined трактуем как «поля нет», повторяя ignoreUndefinedProperties.
    if (value === undefined) continue
    fields[key] = encodeValue(value)
  }
  return fields
}

function decodeValue(value: FirestoreValue): unknown {
  if ('nullValue' in value) return null
  if ('stringValue' in value) return value.stringValue
  if ('booleanValue' in value) return value.booleanValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return value.doubleValue
  // В коде даты хранятся ISO-строками, но в старых документах могут лежать
  // настоящие timestamp — приводим к той же строке, чтобы типы совпадали.
  if ('timestampValue' in value) return value.timestampValue
  if ('arrayValue' in value) {
    const values = (value.arrayValue as {values?: FirestoreValue[]})?.values ?? []
    return values.map(decodeValue)
  }
  if ('mapValue' in value) {
    const fields = (value.mapValue as {fields?: Record<string, FirestoreValue>})?.fields ?? {}
    return decodeFields(fields)
  }
  if ('referenceValue' in value) return value.referenceValue
  if ('geoPointValue' in value) return value.geoPointValue
  if ('bytesValue' in value) return value.bytesValue
  return null
}

function decodeFields(fields: Record<string, FirestoreValue>): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) {
    data[key] = decodeValue(value)
  }
  return data
}

function documentId(document: FirestoreDocument): string {
  return document.name.slice(document.name.lastIndexOf('/') + 1)
}

/** Документ, приведённый к форме `{id, ...поля}` — как отдавал Admin SDK. */
export type WithId<T> = T & {id: string}

function toRecord<T>(document: FirestoreDocument): WithId<T> {
  return {id: documentId(document), ...(decodeFields(document.fields ?? {}) as T)}
}

// --- Транспорт --------------------------------------------------------------

async function firestoreFetch<T>(path: string, init?: RequestInit & {query?: string}): Promise<T> {
  const token = await getAccessToken()
  const url = `${FIRESTORE_HOST}/${path}${init?.query ? `?${init.query}` : ''}`

  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers
    },
    // Записи и запросы под сервис-аккаунтом никогда не кэшируем: кэширование
    // выстроено выше, на уровне unstable_cache с тегами.
    cache: 'no-store'
  })

  if (!response.ok) {
    const body = await response.text()
    throw new FirestoreError(response.status, body)
  }

  return (await response.json()) as T
}

export class FirestoreError extends Error {
  status: number
  constructor(status: number, body: string) {
    super(`Firestore REST ${status}: ${body}`)
    this.status = status
  }
}

// --- Чтение -----------------------------------------------------------------

/**
 * Один документ по пути коллекции и идентификатору.
 * Возвращает null, если документа нет (аналог snapshot.exists === false).
 */
export async function getDoc<T>(collectionPath: string, id: string): Promise<WithId<T> | null> {
  try {
    const document = await firestoreFetch<FirestoreDocument>(
      `${documentsRoot()}/${collectionPath}/${encodeURIComponent(id)}`
    )
    return toRecord<T>(document)
  } catch (error) {
    if (error instanceof FirestoreError && error.status === 404) return null
    throw error
  }
}

export type WhereOperator = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'not-in' | 'array-contains'

const OPERATOR_MAP: Record<WhereOperator, string> = {
  '==': 'EQUAL',
  '!=': 'NOT_EQUAL',
  '<': 'LESS_THAN',
  '<=': 'LESS_THAN_OR_EQUAL',
  '>': 'GREATER_THAN',
  '>=': 'GREATER_THAN_OR_EQUAL',
  in: 'IN',
  'not-in': 'NOT_IN',
  'array-contains': 'ARRAY_CONTAINS'
}

export type WhereClause = [field: string, operator: WhereOperator, value: unknown]
export type OrderByClause = [field: string, direction?: 'asc' | 'desc']

/** Псевдополе идентификатора документа — аналог FieldPath.documentId(). */
export const DOCUMENT_ID = '__name__'

export interface QueryOptions {
  where?: WhereClause[]
  orderBy?: OrderByClause[]
  /** Значения курсора в том же порядке, что и orderBy. */
  startAfter?: unknown[]
  limit?: number
  /**
   * Какие поля вернуть. Без него Firestore отдаёт документы целиком — для
   * выборок вроде карты сайта это лишний трафик. Идентификатор приходит
   * всегда, перечислять его не нужно.
   */
  select?: string[]
}

function buildStructuredQuery(collectionPath: string, options: QueryOptions): Record<string, unknown> {
  const segments = collectionPath.split('/')
  const collectionId = segments[segments.length - 1]

  const query: Record<string, unknown> = {from: [{collectionId}]}

  const filters = (options.where ?? []).map(([field, operator, value]) => ({
    fieldFilter: {
      field: {fieldPath: field},
      op: OPERATOR_MAP[operator],
      // Идентификатор документа Firestore принимает только полной ссылкой.
      value:
        field === DOCUMENT_ID && typeof value === 'string'
          ? {referenceValue: `${documentsRoot()}/${collectionPath}/${value}`}
          : encodeValue(value)
    }
  }))

  if (filters.length === 1) {
    query.where = filters[0]
  } else if (filters.length > 1) {
    query.where = {compositeFilter: {op: 'AND', filters}}
  }

  if (options.orderBy?.length) {
    query.orderBy = options.orderBy.map(([field, direction = 'asc']) => ({
      field: {fieldPath: field},
      direction: direction === 'desc' ? 'DESCENDING' : 'ASCENDING'
    }))
  }

  if (options.startAfter?.length) {
    // Курсор по __name__ Firestore принимает только ссылкой на документ,
    // поэтому значение достраивается до полного пути.
    const values = options.startAfter.map((value, index) => {
      const field = options.orderBy?.[index]?.[0]
      if (field === DOCUMENT_ID && typeof value === 'string') {
        return {referenceValue: `${documentsRoot()}/${collectionPath}/${value}`}
      }
      return encodeValue(value)
    })
    query.startAt = {values, before: false}
  }

  if (options.limit !== undefined) query.limit = options.limit

  if (options.select?.length) {
    query.select = {fields: options.select.map(fieldPath => ({fieldPath}))}
  }

  return query
}

interface RunQueryRow {
  document?: FirestoreDocument
  readTime?: string
  skippedResults?: number
}

/**
 * Запрос по коллекции. Для вложенных коллекций путь передаётся целиком,
 * например `users/<uid>/notifications`.
 */
export async function queryDocs<T>(
  collectionPath: string,
  options: QueryOptions = {},
  transactionId?: string
): Promise<WithId<T>[]> {
  const segments = collectionPath.split('/')
  // Родитель запроса — всё, кроме последнего сегмента (самой коллекции).
  const parentSuffix = segments.slice(0, -1).join('/')
  const parent = parentSuffix ? `${documentsRoot()}/${parentSuffix}` : documentsRoot()

  const body: Record<string, unknown> = {structuredQuery: buildStructuredQuery(collectionPath, options)}
  if (transactionId) body.transaction = transactionId

  const rows = await firestoreFetch<RunQueryRow[]>(`${parent}:runQuery`, {
    method: 'POST',
    body: JSON.stringify(body)
  })

  // Строки без document — служебные (readTime, счётчик пропусков).
  return rows.filter(row => row.document).map(row => toRecord<T>(row.document as FirestoreDocument))
}

// --- Запись -----------------------------------------------------------------

interface WriteOperation {
  update?: {name: string; fields: Record<string, FirestoreValue>}
  updateMask?: {fieldPaths: string[]}
  updateTransforms?: Record<string, unknown>[]
  currentDocument?: {exists: boolean}
}

async function commit(writes: WriteOperation[], transactionId?: string): Promise<void> {
  const body: Record<string, unknown> = {writes}
  if (transactionId) body.transaction = transactionId

  await firestoreFetch(`${databaseRoot()}/documents:commit`, {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

function splitTransforms(data: Record<string, unknown>) {
  const plain: Record<string, unknown> = {}
  const transforms: Record<string, unknown>[] = []

  for (const [key, value] of Object.entries(data)) {
    if (isTransform(value)) {
      transforms.push(value.build(key))
    } else if (value !== undefined) {
      plain[key] = value
    }
  }

  return {plain, transforms}
}

function buildUpdateWrite(documentPath: string, data: Record<string, unknown>, merge: boolean): WriteOperation {
  const {plain, transforms} = splitTransforms(data)

  const write: WriteOperation = {
    update: {name: `${documentsRoot()}/${documentPath}`, fields: encodeFields(plain)}
  }

  // updateMask ограничивает запись перечисленными полями — это и есть разница
  // между update (мержит) и set (перезаписывает документ целиком).
  if (merge) write.updateMask = {fieldPaths: Object.keys(plain)}
  if (transforms.length) write.updateTransforms = transforms

  return write
}

/** Полная перезапись документа — аналог `doc.set(data)`. */
export async function setDoc(collectionPath: string, id: string, data: Record<string, unknown>): Promise<void> {
  await commit([buildUpdateWrite(`${collectionPath}/${id}`, data, false)])
}

/**
 * Частичное обновление — аналог `doc.update(data)`.
 * Значения могут быть сентинелами increment/arrayUnion/arrayRemove: они уходят
 * в updateTransforms того же write, то есть применяются атомарно с полями.
 */
export async function updateDoc(collectionPath: string, id: string, data: Record<string, unknown>): Promise<void> {
  await commit([buildUpdateWrite(`${collectionPath}/${id}`, data, true)])
}

/**
 * Создание документа с автоматическим идентификатором — аналог
 * `collection.add(data)`. Возвращает идентификатор нового документа.
 */
export async function addDoc(collectionPath: string, data: Record<string, unknown>): Promise<string> {
  const document = await firestoreFetch<FirestoreDocument>(`${documentsRoot()}/${collectionPath}`, {
    method: 'POST',
    body: JSON.stringify({fields: encodeFields(data)})
  })
  return documentId(document)
}

// Идентификаторы Firestore — 20 символов из этого алфавита.
const AUTO_ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/**
 * Идентификатор в стиле Firestore, когда он нужен до записи — например,
 * чтобы вернуть созданный документ из транзакции (аналог `collection.doc()`).
 */
export function generateDocumentId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20))
  let id = ''
  for (const byte of bytes) id += AUTO_ID_ALPHABET[byte % AUTO_ID_ALPHABET.length]
  return id
}

// --- Транзакции -------------------------------------------------------------

export interface Transaction {
  /** Чтение внутри транзакции — попадает в её снапшот. */
  query<T>(collectionPath: string, options?: QueryOptions): Promise<WithId<T>[]>
  set(collectionPath: string, id: string, data: Record<string, unknown>): void
}

/**
 * Транзакция Firestore: beginTransaction → чтения → commit.
 * Записи копятся и уходят одним commit вместе с идентификатором транзакции —
 * если данные, прочитанные внутри, успели измениться, Firestore отклонит
 * коммит целиком.
 */
export async function runTransaction<T>(handler: (transaction: Transaction) => Promise<T>): Promise<T> {
  const {transaction: transactionId} = await firestoreFetch<{transaction: string}>(
    `${databaseRoot()}/documents:beginTransaction`,
    {method: 'POST', body: JSON.stringify({options: {readWrite: {}}})}
  )

  const writes: WriteOperation[] = []

  const transaction: Transaction = {
    query: (collectionPath, options = {}) => queryDocs(collectionPath, options, transactionId),
    set: (collectionPath, id, data) => {
      writes.push(buildUpdateWrite(`${collectionPath}/${id}`, data, false))
    }
  }

  try {
    const result = await handler(transaction)
    await commit(writes, transactionId)
    return result
  } catch (error) {
    // Откат освобождает блокировки сразу, не дожидаясь таймаута Firestore.
    await firestoreFetch(`${databaseRoot()}/documents:rollback`, {
      method: 'POST',
      body: JSON.stringify({transaction: transactionId})
    }).catch(() => {})
    throw error
  }
}
