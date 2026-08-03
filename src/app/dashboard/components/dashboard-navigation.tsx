'use client'

import {Link} from '@/lib/navigation'
import {useLanguage} from '@/components/providers'
import type {DashboardTab} from './dashboard-types'

interface DashboardNavigationProps {
  activeTab: DashboardTab
  canModerate: boolean
  onSelect: (tab: DashboardTab) => void
  onOpenModeration: () => void
}

export function DashboardNavigation({activeTab, canModerate, onSelect, onOpenModeration}: DashboardNavigationProps) {
  const {language, t} = useLanguage()
  const paymentLabel = language === 'en' ? 'Plans & payment' : language === 'ru' ? 'Тарифы и оплата' : 'Paketlər və ödəniş'

  return (
    <aside className="dashboard-sidebar">
      <nav className="dashboard-nav">
        <button className={`nav-item ${activeTab === 'listings' ? 'active' : ''}`} onClick={() => onSelect('listings')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          {t.dashboard.myListings}
        </button>
        <button className={`nav-item ${activeTab === 'add' ? 'active' : ''}`} onClick={() => onSelect('add')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/>
          </svg>
          {t.dashboard.addListing}
        </button>
        <button className={`nav-item ${activeTab === 'favorites' ? 'active' : ''}`} onClick={() => onSelect('favorites')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
          {t.dashboard.favorites}
        </button>
        <button className={`nav-item ${activeTab === 'bookings' ? 'active' : ''}`} onClick={() => onSelect('bookings')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4h16v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4z"/>
          </svg>
          {t.dashboard.bookings}
        </button>
        <button className={`nav-item ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => onSelect('notifications')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {t.dashboard.notifications}
        </button>
        <Link className="nav-item" to="/dashboard/payment">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>
          </svg>
          {paymentLabel}
        </Link>
        <button className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => onSelect('profile')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          {t.dashboard.profile}
        </button>
        {canModerate && (
          <button className="nav-item" onClick={onOpenModeration}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12l2 2 4-4"/><path d="M12 3l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4z"/>
            </svg>
            {t.dashboard.moderation}
          </button>
        )}
      </nav>
    </aside>
  )
}
