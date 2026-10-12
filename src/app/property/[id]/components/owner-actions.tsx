'use client'

import React from 'react'
import {useLanguage} from '@/components/providers'
import {InlineSpinner} from '@/components'
import {getFunctions, httpsCallable} from 'firebase/functions'
import {doc, getDoc, getFirestore} from 'firebase/firestore'
import firebaseApp from '@/lib/firebase/client'
import * as logger from '@/services/logger'
// Цены — из общего пакета, своей копии здесь больше нет: приложение показывает
// те же числа, и разъезжаться им нечем.
import {BOOST_PACKAGES, BOOST_PRICES, formatAzn, TIER_PRICES, type BoostPackage} from '@birklik/core/data'
import {isTierActive} from '@birklik/core/utils/premium-helper'
import {isBoostActive} from '@birklik/core/utils/boost-helper'
import type {ListingTier} from '@birklik/core/types'

interface OwnerActionsProps {
  propertyId: string
  /**
   * Тариф, его сроки и дата подъёма. Нужны именно сроки: какую ступень
   * предлагать, решает ДЕЙСТВУЮЩИЙ тариф, а у истёкшего платного поле
   * `listingTier` остаётся прежним — по нему объявление выглядело бы
   * VIP-овским, уже не будучи им.
   */
  listing: {
    listingTier?: ListingTier
    vipExpiresAt?: string
    premiumExpiresAt?: string
    boostedAt?: string
  }
}

/**
 * Повышение тарифа и подъём на своём объявлении.
 *
 * ```
 * обычное или истёкшее   VIP и Premium — обе ступени, плюс подъём
 * действует VIP          продлить VIP либо перейти на Premium
 * действует Premium      только продлить Premium
 * ```
 *
 * ⚠️ Premium-у VIP НЕ предлагается. Оплата VIP проходит через `applyPaidTier`,
 * а она стирает дату прежнего тарифа: объявление стало бы VIP, и оплаченные дни
 * Premium сгорели бы. Кнопки, после которой человек теряет оплаченное, быть не
 * должно — вместо неё стоит объяснение, почему её нет.
 *
 * ⚠️ Подъём предлагается ТОЛЬКО обычному объявлению. Технически он работает и у
 * платных — поднимает внутри своей полосы, — но VIP и Premium и так стоят выше
 * всех обычных, и продавать им то, что у них уже есть, мы не станем. Сервер
 * думает так же и отказывает такому платежу ДО списания денег
 * (`initiatePayment`), поэтому расхождение кнопки с сервером обернулось бы не
 * потерей денег, а отказом.
 *
 * ⚠️ До 2026-10-10 здесь было иначе: VIP-объявлению предлагался только Premium,
 * а Premium-объявлению — НИ ОДНОЙ кнопки, то есть продлить его со страницы
 * объявления было нельзя вообще. Приложение теперь работает по схеме выше, и
 * сайт выровнен по нему, а не наоборот.
 */
export function OwnerActions({propertyId, listing}: OwnerActionsProps) {
  const {language, t} = useLanguage()
  const premiumActive = isTierActive(listing, 'premium')
  const vipActive = isTierActive(listing, 'vip')
  const boostActive = isBoostActive(listing)
  const [upgradeModal, setUpgradeModal] = React.useState<'vip' | 'premium' | null>(null)
  const [boostModal, setBoostModal] = React.useState(false)
  const [isUpgrading, setIsUpgrading] = React.useState(false)
  /** Остаток незаконченного пакета. `null`, пока не прочитали или не смогли. */
  const [boostsLeft, setBoostsLeft] = React.useState<number | null>(null)
  const [paidJustNow, setPaidJustNow] = React.useState(false)

  // Кнопка «İrəli çək» была убрана 2026-08-31: за ней не стояло возможности,
  // клик показывал «скоро». Вернулась вместе с работающим подъёмом.
  const canBoost = !premiumActive && !vipActive

  // Остаток подъёмов лежит в `boosts/{propertyId}` — коллекции, закрытой на
  // запись всем. Читаем из браузера, а не отдаём страницей: страница объявления
  // общая и кэшируется, а это сведения для одного человека.
  React.useEffect(() => {
    if (!canBoost) return
    let alive = true
    void getDoc(doc(getFirestore(firebaseApp), 'boosts', propertyId))
      .then(snapshot => {
        if (!alive) return
        setBoostsLeft(snapshot.exists() ? Number(snapshot.data()?.remaining ?? 0) : 0)
      })
      .catch(() => {
        // Нечитаемый остаток — не повод прятать кнопку: покупка от него не
        // зависит. Строку про остаток просто не покажем.
        if (alive) setBoostsLeft(null)
      })
    return () => {
      alive = false
    }
  }, [propertyId, canBoost])

  // Банк возвращает человека после подъёма сюда же, с `?payment=success`.
  // Читаем адрес напрямую, а не через `useSearchParams`: тот требует обёртки в
  // Suspense при статической отрисовке, а выгоды здесь никакой.
  React.useEffect(() => {
    if (new URLSearchParams(window.location.search).get('payment') === 'success') {
      setPaidJustNow(true)
    }
  }, [])

  const startPayment = async (
    payload:
      | {tier: 'vip' | 'premium'; duration: '14days' | '30days'}
      | {kind: 'boost'; boostCount: BoostPackage}
  ) => {
    setIsUpgrading(true)
    try {
      const fns = getFunctions(firebaseApp, 'europe-west1')
      const initiatePaymentFn = httpsCallable<
        Record<string, unknown>,
        {paymentUrl: string; params: Record<string, string>}
      >(fns, 'initiatePayment')
      const result = await initiatePaymentFn({propertyId, ...payload})
      const {paymentUrl, params} = result.data
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = paymentUrl
      form.style.display = 'none'
      Object.entries(params).forEach(([key, value]) => {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = key
        input.value = value
        form.appendChild(input)
      })
      document.body.appendChild(form)
      form.submit()
    } catch (err) {
      logger.error('Payment failed:', err)
      setIsUpgrading(false)
    }
  }

  const handleUpgradeConfirm = (duration: '14days' | '30days') => {
    if (!upgradeModal) return
    void startPayment({tier: upgradeModal, duration})
  }

  const cancelLabel = language === 'en' ? 'Cancel' : language === 'ru' ? 'Отмена' : 'Ləğv et'

  const redirecting = (
    <p className="pp-upgrade-modal__loading">
      <InlineSpinner label={language === 'en' ? 'Redirecting' : language === 'ru' ? 'Переход' : 'Yönləndirilir'} />{' '}
      {language === 'en' ? 'Redirecting to payment...' : language === 'ru' ? 'Переход к оплате...' : 'Ödənişə yönləndirilir...'}
    </p>
  )

  return (
    <>
      <div className="pp-owner-actions">
        {!premiumActive && (
          <button onClick={() => setUpgradeModal('vip')} className="btn btn-sm pp-owner-btn--vip">
            ★ {vipActive ? t.promote.extendVip : t.promote.upgradeVip}
          </button>
        )}
        <button onClick={() => setUpgradeModal('premium')} className="btn btn-sm pp-owner-btn--premium">
          ◆ {premiumActive ? t.promote.extendPremium : t.promote.upgradePremium}
        </button>
        {canBoost && (
          <button onClick={() => setBoostModal(true)} className="btn btn-sm pp-owner-btn--boost">
            ↑ {t.boost.button}
          </button>
        )}
        {premiumActive && <p className="pp-owner-note">{t.promote.vipNotOffered}</p>}

        {/* Состояние подъёма. Без этой строки купивший пакет не знает ни что
            объявление поднято, ни сколько подъёмов осталось. */}
        {canBoost && (boostActive || paidJustNow) && (
          <p className="pp-owner-note pp-owner-note--boost">
            ↑ {t.boost.activeNow}
            {boostsLeft !== null && boostsLeft > 0
              ? ` · ${t.boost.remaining.replace('{count}', String(boostsLeft))}`
              : ''}
          </p>
        )}
        {canBoost && !boostActive && !paidJustNow && boostsLeft !== null && boostsLeft > 0 && (
          <p className="pp-owner-note">{t.boost.remaining.replace('{count}', String(boostsLeft))}</p>
        )}
      </div>

      {upgradeModal && (
        <div className="pp-upgrade-overlay" onClick={() => { if (!isUpgrading) setUpgradeModal(null) }}>
          <div className="pp-upgrade-modal" onClick={e => e.stopPropagation()}>
            <h3 className="pp-upgrade-modal__title">
              {upgradeModal === 'vip'
                ? (language === 'en' ? '★ Upgrade to VIP' : language === 'ru' ? '★ Обновление до VIP' : '★ VIP-ə yüksəlt')
                : (language === 'en' ? '◆ Upgrade to Premium' : language === 'ru' ? '◆ Обновление до Premium' : '◆ Premium-a yüksəlt')}
            </h3>
            <p className="pp-upgrade-modal__subtitle">
              {language === 'en' ? 'Choose a plan duration' : language === 'ru' ? 'Выберите срок' : 'Müddət seçin'}
            </p>
            <div className="pp-upgrade-modal__options">
              {(['14days', '30days'] as const).map(dur => {
                const price = TIER_PRICES[upgradeModal][dur]
                const days = dur === '14days' ? 14 : 30
                return (
                  <button
                    key={dur}
                    className={`pp-upgrade-modal__option pp-upgrade-modal__option--${upgradeModal}`}
                    onClick={() => handleUpgradeConfirm(dur)}
                    disabled={isUpgrading}
                  >
                    <span className="pp-upgrade-modal__days">
                      {days} {language === 'en' ? 'days' : language === 'ru' ? 'дней' : 'gün'}
                    </span>
                    <span className="pp-upgrade-modal__price">{price} ₼</span>
                  </button>
                )
              })}
            </div>
            <p className="pp-upgrade-modal__note">
              {upgradeModal === 'premium' && vipActive
                ? t.promote.replaceNote
                : (upgradeModal === 'vip' && vipActive) || (upgradeModal === 'premium' && premiumActive)
                ? t.promote.addDaysNote
                : ''}
            </p>
            {isUpgrading
              ? redirecting
              : <button className="pp-upgrade-modal__cancel" onClick={() => setUpgradeModal(null)}>
                  {cancelLabel}
                </button>}
          </div>
        </div>
      )}

      {boostModal && (
        <div className="pp-upgrade-overlay" onClick={() => { if (!isUpgrading) setBoostModal(false) }}>
          <div className="pp-upgrade-modal" onClick={e => e.stopPropagation()}>
            <h3 className="pp-upgrade-modal__title">↑ {t.boost.title}</h3>
            <p className="pp-upgrade-modal__subtitle">{t.boost.subtitle}</p>
            <div className="pp-upgrade-modal__options pp-upgrade-modal__options--boost">
              {BOOST_PACKAGES.map(count => (
                <button
                  key={count}
                  className="pp-upgrade-modal__option pp-upgrade-modal__option--boost"
                  onClick={() => void startPayment({kind: 'boost', boostCount: count})}
                  disabled={isUpgrading}
                >
                  <span className="pp-upgrade-modal__days">
                    {count === 1 ? t.boost.packageOne : t.boost.packageMany.replace('{count}', String(count))}
                  </span>
                  <span className="pp-upgrade-modal__price">{formatAzn(BOOST_PRICES[count])}</span>
                  <span className="pp-upgrade-modal__hint">
                    {count === 1 ? t.boost.oneDay : t.boost.perDay.replace('{count}', String(count))}
                  </span>
                </button>
              ))}
            </div>
            {/* Прибавку к остатку показываем только когда остаток есть: иначе
                строка обещала бы сохранение того, чего нет. */}
            <p className="pp-upgrade-modal__note">
              {boostsLeft !== null && boostsLeft > 0 ? t.boost.addNote : ''}
            </p>
            {isUpgrading
              ? redirecting
              : <button className="pp-upgrade-modal__cancel" onClick={() => setBoostModal(false)}>
                  {cancelLabel}
                </button>}
          </div>
        </div>
      )}
    </>
  )
}
