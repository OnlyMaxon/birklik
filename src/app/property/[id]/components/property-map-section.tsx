'use client'

import dynamic from 'next/dynamic'
import {Loading} from '@/components'
import type {Property} from '@/types'

const PropertyMap = dynamic(
  () => import('@/components/map').then(module => module.PropertyMap),
  {ssr: false, loading: () => <Loading message="Birklik.az" brand />}
)

export function PropertyMapSection({property}: {property: Property}) {
  return (
    <div className="pp-map-wrap">
      <PropertyMap properties={[property]} singleProperty />
    </div>
  )
}
