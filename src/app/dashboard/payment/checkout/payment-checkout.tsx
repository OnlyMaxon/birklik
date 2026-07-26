'use client'

import React from 'react'
import {getFunctions, httpsCallable} from 'firebase/functions'
import {Layout} from '@/components/app-layout'
import {useLanguage} from '@/components/providers'
import firebaseApp from '@/lib/firebase/client'
import {Link} from '@/lib/navigation'
import * as logger from '@/services/logger'
import '../payment.css'

type PaymentCheckoutProps = {
  propertyId: string
  tier: 'vip' | 'premium'
  duration: '14days' | '30days'
}

function submitPaymentForm(paymentUrl: string, params: Record<string, string>) {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = paymentUrl
  form.style.display = 'none'

  for (const [name, value] of Object.entries(params)) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.appendChild(input)
  }

  document.body.appendChild(form)
  form.submit()
}

export function PaymentCheckout({propertyId, tier, duration}: PaymentCheckoutProps) {
  const {language} = useLanguage()
  const [error, setError] = React.useState(false)
  const [attempt, setAttempt] = React.useState(0)
  const started = React.useRef(false)

  React.useEffect(() => {
    if (started.current) return
    started.current = true
    setError(false)

    const initiate = async () => {
      try {
        const functions = getFunctions(firebaseApp, 'europe-west1')
        const initiatePayment = httpsCallable<
          PaymentCheckoutProps,
          {paymentUrl: string; params: Record<string, string>}
        >(functions, 'initiatePayment')
        const result = await initiatePayment({propertyId, tier, duration})
        submitPaymentForm(result.data.paymentUrl, result.data.params)
      } catch (paymentError) {
        logger.error('Payment initiation failed:', paymentError)
        setError(true)
      }
    }

    void initiate()
  }, [attempt, duration, propertyId, tier])

  const text = language === 'en'
    ? {title: 'Connecting to Azericard', body: 'Please wait while we open the secure payment page.', error: 'Payment could not be started.', retry: 'Try again', back: 'Choose another plan'}
    : language === 'ru'
      ? {title: 'Подключение к Azericard', body: 'Подождите, открывается защищённая страница оплаты.', error: 'Не удалось начать оплату.', retry: 'Попробовать снова', back: 'Выбрать другой тариф'}
      : {title: 'Azericard-a qoşulur', body: 'Təhlükəsiz ödəniş səhifəsi açılarkən gözləyin.', error: 'Ödənişi başlatmaq mümkün olmadı.', retry: 'Yenidən cəhd et', back: 'Başqa paket seç'}

  return (
    <Layout>
      <main className="payment-page">
        <div className="container payment-status card">
          <div className={error ? 'payment-status__mark payment-status__mark--error' : 'payment-spinner'} aria-hidden="true">
            {error ? '!' : ''}
          </div>
          <h1>{error ? text.error : text.title}</h1>
          {!error && <p>{text.body}</p>}
          {error && (
            <div className="payment-status__actions">
              <button
                className="btn btn-primary"
                onClick={() => {
                  started.current = false
                  setAttempt(value => value + 1)
                }}
              >
                {text.retry}
              </button>
              <Link className="btn btn-ghost" to={`/dashboard/payment?propertyId=${encodeURIComponent(propertyId)}`}>{text.back}</Link>
            </div>
          )}
        </div>
      </main>
    </Layout>
  )
}
