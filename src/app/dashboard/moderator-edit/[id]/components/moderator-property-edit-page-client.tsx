'use client'

import dynamic from 'next/dynamic'
import {Loading} from '@/components/loading'

const ModeratorPropertyEditPage = dynamic(
  () => import('./moderator-property-edit-page').then(module => module.ModeratorPropertyEditPage),
  {ssr: false, loading: () => <Loading fullScreen message="Birklik.az" brand />}
)

export function ModeratorPropertyEditPageClient() {
  return <ModeratorPropertyEditPage />
}
