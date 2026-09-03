'use client'

import dynamic from 'next/dynamic'
import {MapSkeleton} from '@/components'
import type {Property} from '@birklik/core/types'

const PropertyMap = dynamic(
  () => import('@/components/map').then(module => module.PropertyMap),
  {ssr: false, loading: () => <MapSkeleton />}
)

export function PropertyMapSection({property}: {property: Property}) {
  return (
    <div className="pp-map-wrap">
      <PropertyMap properties={[property]} singleProperty />
    </div>
  )
}
