import {describe, expect, it, vi, afterEach} from 'vitest'
import {isTierActive, isTierExpired, tierExpiresAt, tierRank, tierRemainingDays} from './premium-helper'

// Даты в базе лежат в двух видах: 'YYYY-MM-DD' от банка и полный ISO из
// редактора модератора. Тесты держат оба.
const inDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString()
const dateOnly = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)

afterEach(() => {
  vi.useRealTimers()
})

describe('isTierActive', () => {
  it('признаёт действующим тариф со своей непросроченной датой', () => {
    expect(isTierActive({listingTier: 'premium', premiumExpiresAt: inDays(5)}, 'premium')).toBe(true)
    expect(isTierActive({listingTier: 'vip', vipExpiresAt: inDays(5)}, 'vip')).toBe(true)
  })

  it('не показывает Premium, если тариф уже не premium', () => {
    // Ровно это давало значок Premium двум бесплатным объявлениям: дата
    // оставалась в документе после смены тарифа, а проверялась только она.
    expect(isTierActive({listingTier: 'standard', premiumExpiresAt: inDays(30)}, 'premium')).toBe(false)
  })

  it('гасит VIP после окончания срока', () => {
    // Прежний код спрашивал только тариф, поэтому корона не гасла никогда.
    expect(isTierActive({listingTier: 'vip', vipExpiresAt: inDays(-1)}, 'vip')).toBe(false)
  })

  it('считает платный тариф без даты недействующим', () => {
    expect(isTierActive({listingTier: 'premium'}, 'premium')).toBe(false)
  })

  it('не путает тарифы между собой', () => {
    expect(isTierActive({listingTier: 'vip', vipExpiresAt: inDays(5)}, 'premium')).toBe(false)
  })

  it('держит короткую дату до конца её дня', () => {
    // 'YYYY-MM-DD' разбирается как полночь UTC, поэтому наивное сравнение
    // считало последний оплаченный день прошедшим с самого утра.
    vi.useFakeTimers()
    const today = new Date()
    vi.setSystemTime(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 9, 0, 0)))
    const todayShort = new Date().toISOString().slice(0, 10)
    expect(isTierActive({listingTier: 'premium', premiumExpiresAt: todayShort}, 'premium')).toBe(true)
  })

  it('не падает на испорченной дате', () => {
    expect(isTierActive({listingTier: 'premium', premiumExpiresAt: 'не дата'}, 'premium')).toBe(false)
  })
})

describe('isTierExpired', () => {
  it('у бесплатного тарифа истекать нечему', () => {
    expect(isTierExpired({listingTier: 'standard'})).toBe(false)
  })

  it('платный тариф без даты считается истёкшим — такую запись надо чинить', () => {
    expect(isTierExpired({listingTier: 'vip'})).toBe(true)
  })

  it('различает действующий и просроченный срок', () => {
    expect(isTierExpired({listingTier: 'vip', vipExpiresAt: inDays(3)})).toBe(false)
    expect(isTierExpired({listingTier: 'vip', vipExpiresAt: dateOnly(-3)})).toBe(true)
  })
})

describe('tierRank', () => {
  it('ставит Premium выше VIP, а VIP выше обычного', () => {
    expect(tierRank({listingTier: 'premium', premiumExpiresAt: inDays(5)})).toBe(3)
    expect(tierRank({listingTier: 'vip', vipExpiresAt: inDays(5)})).toBe(2)
    expect(tierRank({listingTier: 'standard'})).toBe(1)
  })

  it('опускает истёкший платный тариф к обычным', () => {
    expect(tierRank({listingTier: 'premium', premiumExpiresAt: inDays(-1)})).toBe(1)
    expect(tierRank({listingTier: 'vip', vipExpiresAt: inDays(-1)})).toBe(1)
  })

  it('не поднимает VIP без даты', () => {
    // Прежняя формула трактовала отсутствие даты как «бессрочный VIP».
    expect(tierRank({listingTier: 'vip'})).toBe(1)
  })
})

describe('tierExpiresAt и tierRemainingDays', () => {
  it('берут дату того тарифа, который включён', () => {
    const listing = {listingTier: 'vip' as const, vipExpiresAt: inDays(2), premiumExpiresAt: inDays(90)}
    expect(tierExpiresAt(listing)).toBe(listing.vipExpiresAt)
    expect(tierRemainingDays(listing)).toBe(2)
  })

  it('у бесплатного тарифа даты нет и дней не осталось', () => {
    expect(tierExpiresAt({listingTier: 'standard', premiumExpiresAt: inDays(10)})).toBeUndefined()
    expect(tierRemainingDays({listingTier: 'standard'})).toBe(0)
  })

  it('после окончания срока возвращает ноль, а не отрицательное число', () => {
    expect(tierRemainingDays({listingTier: 'premium', premiumExpiresAt: inDays(-5)})).toBe(0)
  })
})
