import {redirect} from 'next/navigation'
import {PaymentCheckout} from './payment-checkout'

type CheckoutPageProps = {
  searchParams: Promise<{
    propertyId?: string | string[]
    tier?: string | string[]
    duration?: string | string[]
  }>
}

export default async function CheckoutPage({searchParams}: CheckoutPageProps) {
  const params = await searchParams
  const propertyId = typeof params.propertyId === 'string' ? params.propertyId : ''
  const tier = params.tier === 'vip' || params.tier === 'premium' ? params.tier : null
  const duration = params.duration === '14days' || params.duration === '30days' ? params.duration : null

  if (!propertyId || !tier || !duration) {
    redirect('/dashboard/payment')
  }

  return <PaymentCheckout propertyId={propertyId} tier={tier} duration={duration} />
}
