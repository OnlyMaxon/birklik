import {PaymentPlans} from './payment-plans'

type PaymentPageProps = {
  searchParams: Promise<{propertyId?: string | string[]}>
}

export default async function PaymentPage({searchParams}: PaymentPageProps) {
  const params = await searchParams
  const propertyId = typeof params.propertyId === 'string' ? params.propertyId : ''
  return <PaymentPlans initialPropertyId={propertyId} />
}
