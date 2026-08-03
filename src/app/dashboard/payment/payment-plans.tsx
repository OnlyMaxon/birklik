'use client'

import React from 'react'
import {useAuth, useLanguage} from '@/components/providers'
import {Link} from '@/lib/navigation'
import {getPropertiesByOwner} from '@/services'
import type {Property} from '@/types'
import './payment.css'

type PaidTier = 'vip' | 'premium'
type Duration = '14days' | '30days'

const PAID_PLANS: Array<{tier: PaidTier; duration: Duration; days: number; price: number}> = [
  {tier: 'vip', duration: '14days', days: 14, price: 20},
  {tier: 'vip', duration: '30days', days: 30, price: 30},
  {tier: 'premium', duration: '14days', days: 14, price: 30},
  {tier: 'premium', duration: '30days', days: 30, price: 55},
]

function localizedTitle(property: Property, language: 'az' | 'en' | 'ru') {
  return property.title[language] || property.title.az || property.title.en || property.id
}

export function PaymentPlans({initialPropertyId}: {initialPropertyId: string}) {
  const {user} = useAuth()
  const {language} = useLanguage()
  const [properties, setProperties] = React.useState<Property[]>([])
  const [selectedPropertyId, setSelectedPropertyId] = React.useState(initialPropertyId)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!user) return
    let active = true
    void getPropertiesByOwner(user.id).then(items => {
      if (!active) return
      const payable = items.filter(item => item.status !== 'draft')
      setProperties(payable)
      setSelectedPropertyId(current =>
        payable.some(item => item.id === current) ? current : (payable[0]?.id ?? '')
      )
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [user])

  const text = language === 'en'
    ? {
        eyebrow: 'Listing promotion',
        title: 'Choose a plan',
        subtitle: 'Select the listing you want to promote, then choose a duration.',
        listing: 'Listing',
        select: 'Select a listing',
        standard: 'Standard',
        standardDescription: 'Publish a regular listing with no promotion fee.',
        create: 'Create Standard listing',
        vip: 'VIP',
        premium: 'Premium',
        days: 'days',
        pay: 'Continue to payment',
        noListings: 'Create a Standard listing before purchasing VIP or Premium.',
        back: 'Back to dashboard',
      }
    : language === 'ru'
      ? {
          eyebrow: 'Продвижение объявления',
          title: 'Выберите тариф',
          subtitle: 'Выберите объявление для продвижения, затем срок тарифа.',
          listing: 'Объявление',
          select: 'Выберите объявление',
          standard: 'Стандарт',
          standardDescription: 'Опубликуйте обычное объявление без платы за продвижение.',
          create: 'Создать объявление Standard',
          vip: 'VIP',
          premium: 'Premium',
          days: 'дней',
          pay: 'Перейти к оплате',
          noListings: 'Создайте объявление Standard перед покупкой VIP или Premium.',
          back: 'Вернуться в кабинет',
        }
      : {
          eyebrow: 'Elanın irəli çəkilməsi',
          title: 'Paket seçin',
          subtitle: 'İrəli çəkmək istədiyiniz elanı, sonra isə müddəti seçin.',
          listing: 'Elan',
          select: 'Elan seçin',
          standard: 'Standart',
          standardDescription: 'İrəli çəkmə haqqı olmadan adi elan yayımlayın.',
          create: 'Standart elan yarat',
          vip: 'VIP',
          premium: 'Premium',
          days: 'gün',
          pay: 'Ödənişə keç',
          noListings: 'VIP və ya Premium almadan əvvəl Standart elan yaradın.',
          back: 'Kabinetə qayıt',
        }

  return (
    <>
      <main className="payment-page">
        <div className="container payment-shell">
          <div className="payment-heading">
            <span>{text.eyebrow}</span>
            <h1>{text.title}</h1>
            <p>{text.subtitle}</p>
          </div>

          <section className="payment-property card">
            <label htmlFor="payment-property">{text.listing}</label>
            <select
              id="payment-property"
              value={selectedPropertyId}
              onChange={event => setSelectedPropertyId(event.target.value)}
              disabled={loading || properties.length === 0}
            >
              <option value="">{loading ? '…' : text.select}</option>
              {properties.map(property => (
                <option key={property.id} value={property.id}>
                  {localizedTitle(property, language)} · {property.listingTier ?? 'standard'}
                </option>
              ))}
            </select>
            {!loading && properties.length === 0 && <p className="payment-help">{text.noListings}</p>}
          </section>

          <div className="payment-plans">
            <article className="payment-plan card payment-plan--standard">
              <div className="payment-plan__icon">●</div>
              <h2>{text.standard}</h2>
              <div className="payment-plan__price">0 ₼</div>
              <p>{text.standardDescription}</p>
              <Link className="btn btn-outline" to="/dashboard/add">{text.create}</Link>
            </article>

            {PAID_PLANS.map(plan => {
              const checkout = `/dashboard/payment/checkout?propertyId=${encodeURIComponent(selectedPropertyId)}&tier=${plan.tier}&duration=${plan.duration}`
              return (
                <article
                  className={`payment-plan card payment-plan--${plan.tier}`}
                  id={`${plan.tier}-${plan.duration}`}
                  key={`${plan.tier}-${plan.duration}`}
                >
                  <div className="payment-plan__icon">{plan.tier === 'vip' ? '★' : '◆'}</div>
                  <h2>{plan.tier === 'vip' ? text.vip : text.premium}</h2>
                  <div className="payment-plan__price">{plan.price} ₼</div>
                  <p>{plan.days} {text.days}</p>
                  {selectedPropertyId
                    ? <Link className="btn btn-primary" to={checkout}>{text.pay}</Link>
                    : <button className="btn btn-primary" disabled>{text.select}</button>}
                </article>
              )
            })}
          </div>

          <Link className="payment-back" to="/dashboard">← {text.back}</Link>
        </div>
      </main>
    </>
  )
}
