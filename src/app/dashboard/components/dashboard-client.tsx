'use client'

import React from 'react'
import {useNavigate, useSearchParams} from '@/lib/navigation'
import { useLanguage, useAuth } from '@/components/providers'
import {FavoritesTab} from './favorites-tab'
import {BookingsTab} from './bookings-tab'
import {NotificationsTab} from './notifications-tab'
import {DashboardNavigation} from './dashboard-navigation'
import {ListingsTab} from './listings-tab'
import {ListingEditor} from './listing-editor'
import {ProfileTab} from './profile-tab'
import type {DashboardTab, PaymentNotification} from './dashboard-types'
import { isModerator } from '@/lib/auth/permissions'
import type {Property} from '@/types'
import {getPropertiesByOwner, updateProperty} from '@/services'
import {useListingEditor} from '../hooks/use-listing-editor'

interface DashboardClientProps {
  initialTab?: DashboardTab
}

const getTodayISO = (): string => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const isOccupationExpired = (property: Property): boolean => {
  if (!property.unavailableTo) return false
  return property.unavailableTo < getTodayISO()
}


export const DashboardClient: React.FC<DashboardClientProps> = ({ initialTab = 'listings' }) => {
  const {t} = useLanguage()
  const {user, isAuthenticated, firebaseUser} = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as DashboardTab | null
  const [activeTab, setActiveTab] = React.useState<DashboardTab>(tabParam || initialTab)
  const [paymentNotification, setPaymentNotification] = React.useState<PaymentNotification>(null)
  const [listings, setListings] = React.useState<Property[]>([])
  const [isLoadingListings, setIsLoadingListings] = React.useState(false)
  const [isTestAccount, setIsTestAccount] = React.useState(false)


  // Check if user is moderator
  React.useEffect(() => {
    const checkModerator = async () => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdTokenResult()
        setIsTestAccount(isModerator(token))
      }
    }
    checkModerator()
  }, [firebaseUser])
  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
    }
  }, [isAuthenticated, navigate])

  // Sync activeTab with URL search params
  React.useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam)
    }
  }, [tabParam])

  // Handle payment result from Azericard redirect
  React.useEffect(() => {
    const paymentParam = searchParams.get('payment')
    if (paymentParam === 'success' || paymentParam === 'failed' || paymentParam === 'error') {
      setPaymentNotification(paymentParam)
      setActiveTab('listings')
      setTimeout(() => setPaymentNotification(null), 6000)
    }
  }, [])


  const loadListings = React.useCallback(async () => {
    if (!user) return

    setIsLoadingListings(true)
    const ownerListings = await getPropertiesByOwner(user.id)

    const expiredInactive = ownerListings.filter(
      listing => listing.isActive === false && isOccupationExpired(listing)
    )

    if (expiredInactive.length > 0) {
      await Promise.all(
        expiredInactive.map((listing) =>
          updateProperty(listing.id, {
            isActive: true,
            unavailableFrom: '',
            unavailableTo: ''
          })
        )
      )
    }

    const normalizedListings = ownerListings.map(listing => {
      if (listing.isActive === false && isOccupationExpired(listing)) {
        return {
          ...listing,
          isActive: true,
          unavailableFrom: '',
          unavailableTo: ''
        }
      }

      return listing
    })

    setListings(normalizedListings)
    setIsLoadingListings(false)
  }, [user])

  React.useEffect(() => {
    if (activeTab === 'listings' && user) {
      loadListings()
    }
  }, [activeTab, user, loadListings])

  const listingEditor = useListingEditor({
    listings,
    onEditStarted: () => setActiveTab('add'),
    onSaved: () => {
      setActiveTab('listings')
      void loadListings()
    }
  })

  if (!isAuthenticated || !user) {
    return null
  }


  return (
    <>
      <div className="dashboard-page">
        <div className="container">
          <div className="dashboard-header">
            <div className="user-info">
              <img src={user.avatar} alt={user.name} className="dashboard-user-avatar" />
              <div>
                <h1>{t.dashboard.welcome}, {user.name}!</h1>
                <p>{user.email}</p>
              </div>
            </div>
          </div>

          <div className="dashboard-layout">
            <DashboardNavigation
              activeTab={activeTab}
              canModerate={isTestAccount}
              onSelect={setActiveTab}
              onOpenModeration={() => navigate('/dashboard/review')}
            />

            {/* Main Content */}
            <main className="dashboard-content">
              {activeTab === 'listings' && (
                <ListingsTab
                  listings={listings}
                  isLoading={isLoadingListings}
                  paymentNotification={paymentNotification}
                  onAdd={() => setActiveTab('add')}
                  onEdit={listingEditor.editListing}
                  onReload={loadListings}
                />
              )}

              {activeTab === 'add' && (
                <ListingEditor
                  {...listingEditor.editorProps}
                  onCancel={() => {
                    setActiveTab('listings')
                    listingEditor.reset()
                  }}
                />
              )}

              {/* Favorites Tab */}
              {activeTab === 'favorites' && <FavoritesTab />}

              {/* Bookings Tab */}
              {activeTab === 'bookings' && <BookingsTab />}



              {/* Notifications Tab */}
              {activeTab === 'notifications' && <NotificationsTab />}

              {activeTab === 'profile' && <ProfileTab />}


            </main>
          </div>
        </div>
      </div>

    </>
  )
}
