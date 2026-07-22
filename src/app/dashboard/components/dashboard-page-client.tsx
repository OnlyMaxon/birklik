'use client'

import dynamic from 'next/dynamic'
import {Loading} from '@/components/loading'

const DashboardPage = dynamic(
  () => import('./dashboard-page').then(module => module.DashboardPage),
  {ssr: false, loading: () => <Loading fullScreen message="Birklik.az" brand />}
)

export function DashboardPageClient() {
  return <DashboardPage />
}
