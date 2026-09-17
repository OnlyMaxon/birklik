import {beforeEach, describe, expect, it, vi} from 'vitest'
import type {Property} from '@birklik/core/types'

const restMocks = vi.hoisted(() => ({queryDocsMock: vi.fn()}))

vi.mock('@/lib/firebase/firestore-rest', () => ({
  queryDocs: restMocks.queryDocsMock,
  DOCUMENT_ID: '__name__'
}))

// unstable_cache вне Next просто мешает: getPropertiesPage через него не
// проходит, но модуль зовёт его на импорте для соседних выборок.
vi.mock('next/cache', () => ({unstable_cache: (fn: unknown) => fn}))

const {getPropertiesPage} = await import('./queries')

/** Объявление ровно с теми полями, которые читает выборка страницы. */
function listing(index: number, extra: Partial<Property> = {}): Property {
  return {
    id: `id-${String(index).padStart(3, '0')}`,
    status: 'active',
    listingTier: 'standard',
    // Убывающая дата: ровно тот порядок, в котором их отдаёт Firestore.
    createdAt: new Date(Date.UTC(2026, 0, 1) - index * 86_400_000).toISOString(),
    ...extra
  } as Property
}

/** Просроченный VIP: Firestore его отдаёт, isOnDisplay убирает. */
const expired = (index: number) =>
  listing(index, {listingTier: 'vip', vipExpiresAt: '2020-01-01T00:00:00.000Z'})

describe('getPropertiesPage', () => {
  beforeEach(() => {
    restMocks.queryDocsMock.mockReset()
  })

  it('продолжает выдачу, когда лишний документ-признак отсеян по истёкшему тарифу', async () => {
    // Двадцать один документ — двадцать на страницу плюс признак продолжения.
    // Один из них просрочен, и раньше именно это обнуляло курсор: отсев
    // применялся до подсчёта, 21 превращалось в 20, и главная навсегда
    // застревала на первой странице.
    const documents = [expired(0), ...Array.from({length: 20}, (_, i) => listing(i + 1))]
    restMocks.queryDocsMock.mockResolvedValue(documents)

    const page = await getPropertiesPage({}, null)

    expect(page.cursor).not.toBeNull()
    // Просроченное на витрину не попало, но страницу не оборвало.
    expect(page.properties).toHaveLength(19)
    expect(page.properties.some(p => p.id === 'id-000')).toBe(false)
  })

  it('ведёт курсор по сырому документу, а не по последнему видимому', async () => {
    // Просрочен последний из двадцати. Продолжать надо всё равно с него —
    // иначе следующая страница выдала бы уже показанные объявления заново.
    const documents = [...Array.from({length: 19}, (_, i) => listing(i)), expired(19), listing(20)]
    restMocks.queryDocsMock.mockResolvedValue(documents)

    const page = await getPropertiesPage({}, null)

    expect(page.cursor?.id).toBe('id-019')
    expect(page.properties).toHaveLength(19)
  })

  it('отдаёт пустой курсор на последней странице', async () => {
    restMocks.queryDocsMock.mockResolvedValue(Array.from({length: 12}, (_, i) => listing(i)))

    const page = await getPropertiesPage({}, null)

    expect(page.cursor).toBeNull()
    expect(page.properties).toHaveLength(12)
  })

  it('не считает страницу последней, когда видимых меньше двадцати, а документов больше', async () => {
    // Крайний случай той же ошибки: просрочена половина страницы. Видимых
    // девять, но продолжение есть, и оборвать выдачу нельзя.
    const documents = [
      ...Array.from({length: 9}, (_, i) => listing(i)),
      ...Array.from({length: 11}, (_, i) => expired(i + 9)),
      listing(20)
    ]
    restMocks.queryDocsMock.mockResolvedValue(documents)

    const page = await getPropertiesPage({}, null)

    expect(page.properties).toHaveLength(9)
    expect(page.cursor).not.toBeNull()
  })
})
