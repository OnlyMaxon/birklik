'use client'

import React from 'react'
import {useLanguage} from '@/components/providers'
import {InlineSpinner} from '@/components'
import {getFunctions, httpsCallable} from 'firebase/functions'
import firebaseApp from '@/lib/firebase/client'
import * as logger from '@/services/logger'
// Цены — из общего пакета, своей копии здесь больше нет: приложение показывает
// те же числа, и разъезжаться им нечем.
import {TIER_PRICES} from '@birklik/core/data'
import {isTierActive} from '@birklik/core/utils/premium-helper'
import type {ListingTier} from '@birklik/core/types'

interface OwnerActionsProps {
  propertyId: string
  /**
   * Тариф и его сроки. Нужны именно сроки: какую ступень предлагать, решает
   * ДЕЙСТВУЮЩИЙ тариф, а у истёкшего платного поле `listingTier` остаётся
   * прежним — по нему объявление выглядело бы VIP-овским, уже не будучи им.
   */
  listing: {listingTier?: ListingTier; vipExpiresAt?: string; premiumExpiresAt?: string}
}

/**
 * Повышение тарифа на своём объявлении.
 *
 * ```
 * обычное или истёкшее   VIP и Premium — обе ступени
 * действует VIP          продлить VIP либо перейти на Premium
 * действует Premium      только продлить Premium
 * ```
 *
 * ⚠️ Premium-у VIP НЕ предлагается. Оплата VIP проходит через `applyPaidTier`,
 * а она стирает дату прежнего тарифа: объявление стало бы VIP, и оплаченные дни
 * Premium сгорели бы. Кнопки, после которой человек теряет оплаченное, быть не
 * должно — вместо неё стоит объяснение, почему её нет.
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
  const [upgradeModal, setUpgradeModal] = React.useState<'vip' | 'premium' | null>(null)
  const [isUpgrading, setIsUpgrading] = React.useState(false)

  // Кнопка «İreli Çək» убрана (2026-08-31). Возможности за ней не было: клик
  // показывал «скоро». Появится — вернём вместе с работающим поведением.
  const handleUpgradeConfirm = async (duration: '14days' | '30days') => {
    if (!upgradeModal) return
    setIsUpgrading(true)
    try {
      const fns = getFunctions(firebaseApp, 'europe-west1')
      const initiatePaymentFn = httpsCallable<
        {propertyId: string; tier: string; duration: string},
        {paymentUrl: string; params: Record<string, string>}
      >(fns, 'initiatePayment')
      const result = await initiatePaymentFn({propertyId, tier: upgradeModal, duration})
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
      logger.error('Upgrade payment failed:', err)
      setIsUpgrading(false)
    }
  }

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
        {premiumActive && <p className="pp-owner-note">{t.promote.vipNotOffered}</p>}
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
              ? <p className="pp-upgrade-modal__loading">
                  <InlineSpinner label={language === 'en' ? 'Redirecting' : language === 'ru' ? 'Переход' : 'Yönləndirilir'} />{' '}
                  {language === 'en' ? 'Redirecting to payment...' : language === 'ru' ? 'Переход к оплате...' : 'Ödənişə yönləndirilir...'}
                </p>
              : <button className="pp-upgrade-modal__cancel" onClick={() => setUpgradeModal(null)}>
                  {language === 'en' ? 'Cancel' : language === 'ru' ? 'Отмена' : 'Ləğv et'}
                </button>}
          </div>
        </div>
      )}
    </>
  )
}
