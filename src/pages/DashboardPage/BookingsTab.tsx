import React from 'react'
import { useLanguage, useAuth } from '../../context'
import { Booking, Property } from '../../types'
import { collection, query, where, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { getUserBookings } from '../../services'
import { Loading } from '../../components'
import * as logger from '../../services/logger'

interface BookingWithProperty extends Booking {
  propertyTitle?: string
  propertyImage?: string
  ownerName?: string
  ownerPhone?: string
  ownerEmail?: string
}

export const BookingsTab: React.FC = () => {
  const { language } = useLanguage()
  const { user } = useAuth()
  const [activeSubTab, setActiveSubTab] = React.useState<'my-bookings' | 'requests'>('my-bookings')
  const [myBookings, setMyBookings] = React.useState<BookingWithProperty[]>([])
  const [incomingRequests, setIncomingRequests] = React.useState<BookingWithProperty[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [isCanceiling, setIsCanceling] = React.useState<string | null>(null)

  const t = {
    myBookings: language === 'en' ? 'My Bookings' : language === 'ru' ? 'Мои Бронирования' : 'Mənim Bölmələrim',
    requests: language === 'en' ? 'Booking Requests' : language === 'ru' ? 'Запросы на Бронирование' : 'Bölmə Sorğuları',
    property: language === 'en' ? 'Property' : language === 'ru' ? 'Свойство' : 'Əmlak',
    dates: language === 'en' ? 'Dates' : language === 'ru' ? 'Даты' : 'Tarix',
    nights: language === 'en' ? 'nights' : language === 'ru' ? 'ночи' : 'gecə',
    total: language === 'en' ? 'Total' : language === 'ru' ? 'Итого' : 'Cəmi',
    guest: language === 'en' ? 'Guest' : language === 'ru' ? 'Гость' : 'Qonaq',
    contact: language === 'en' ? 'Contact' : language === 'ru' ? 'Контакт' : 'Əlaqə',
    phone: language === 'en' ? 'Phone' : language === 'ru' ? 'Телефон' : 'Telefon',
    email: language === 'en' ? 'Email' : language === 'ru' ? 'Email' : 'Email',
    cancel: language === 'en' ? 'Cancel Booking' : language === 'ru' ? 'Отменить' : 'Ləğv Et',
    confirm: language === 'en' ? 'Confirm Cancel' : language === 'ru' ? 'Подтвердить отмену' : 'Ləğvini Təsdiq Et',
    empty: language === 'en' ? 'No bookings yet' : language === 'ru' ? 'Нет бронирований' : 'Hələ bölmə yoxdur',
    owner: language === 'en' ? 'Owner' : language === 'ru' ? 'Владелец' : 'Sahibi',
    status: language === 'en' ? 'Status' : language === 'ru' ? 'Статус' : 'Status',
    loading: language === 'en' ? 'Loading bookings...' : language === 'ru' ? 'Загрузка бронирований...' : 'Bölmələr yüklənir...'
  }

  // Load my bookings (bookings user made)
  const loadMyBookings = React.useCallback(async () => {
    if (!user?.id) return

    try {
      const bookings = await getUserBookings(user.id)
      const bookingsWithDetails: BookingWithProperty[] = []

      for (const booking of bookings) {
        try {
          const propertyDoc = await getDoc(doc(db, 'properties', booking.propertyId))
          const property = propertyDoc.data() as Property | undefined

          bookingsWithDetails.push({
            ...booking,
            propertyTitle: property?.title?.[language] || 'Property',
            propertyImage: property?.images?.[0]
          })
        } catch (err) {
          logger.error(`Error loading property ${booking.propertyId}:`, err)
          bookingsWithDetails.push(booking)
        }
      }

      setMyBookings(bookingsWithDetails)
    } catch (err) {
      logger.error('Error loading my bookings:', err)
      setError(t.loading)
    }
  }, [user?.id, language])

  // Load incoming booking requests (bookings on user's properties)
  const loadIncomingRequests = React.useCallback(async () => {
    if (!user?.id) return

    try {
      // Get all user's properties
      const propsRef = collection(db, 'properties')
      const propsQuery = query(propsRef, where('ownerId', '==', user.id))
      const propsSnapshot = await getDocs(propsQuery)
      const propertyIds = propsSnapshot.docs.map(doc => doc.id)

      if (propertyIds.length === 0) {
        setIncomingRequests([])
        return
      }

      // Get all bookings for these properties
      const bookingsRef = collection(db, 'bookings')
      const allBookings: BookingWithProperty[] = []

      for (const propertyId of propertyIds) {
        const bookingsQuery = query(bookingsRef, where('propertyId', '==', propertyId), where('status', '==', 'active'))
        const bookingsSnap = await getDocs(bookingsQuery)

        const property = propsSnapshot.docs.find(d => d.id === propertyId)?.data() as Property | undefined

        bookingsSnap.docs.forEach(bookingDoc => {
          const booking = bookingDoc.data() as Omit<Booking, 'id'>
          allBookings.push({
            id: bookingDoc.id,
            ...booking,
            propertyTitle: property?.title?.[language] || 'Property',
            propertyImage: property?.images?.[0]
          })
        })
      }

      setIncomingRequests(allBookings)
    } catch (err) {
      logger.error('Error loading booking requests:', err)
    }
  }, [user?.id, language])

  React.useEffect(() => {
    setIsLoading(true)
    setError('')

    const load = async () => {
      await loadMyBookings()
      await loadIncomingRequests()
      setIsLoading(false)
    }

    load()
  }, [loadMyBookings, loadIncomingRequests])

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm(t.confirm)) return

    try {
      setIsCanceling(bookingId)
      await deleteDoc(doc(db, 'bookings', bookingId))
      setMyBookings(prev => prev.filter(b => b.id !== bookingId))
    } catch (err) {
      logger.error('Error canceling booking:', err)
      setError(language === 'en' ? 'Failed to cancel booking' : language === 'ru' ? 'Не удалось отменить бронирование' : 'Bölməni ləğv etmək olmadı')
    } finally {
      setIsCanceling(null)
    }
  }

  if (isLoading) {
    return <Loading message={t.loading} />
  }

  return (
    <div className="bookings-tab">
      <div className="bookings-tabs-header">
        <button
          className={`tab-button ${activeSubTab === 'my-bookings' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('my-bookings')}
        >
          {t.myBookings}
        </button>
        <button
          className={`tab-button ${activeSubTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('requests')}
        >
          {t.requests}
        </button>
      </div>

      {error && <div className="error-message" style={{ color: '#d32f2f', marginBottom: '1rem' }}>{error}</div>}

      {activeSubTab === 'my-bookings' && (
        <div className="bookings-grid">
          {myBookings.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', color: '#888' }}>
              {t.empty}
            </div>
          ) : (
            myBookings.map(booking => (
              <div key={booking.id} className="booking-card" style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '1rem', backgroundColor: '#fafafa' }}>
                {booking.propertyImage && (
                  <img src={booking.propertyImage} alt="property" style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '4px', marginBottom: '0.5rem' }} />
                )}
                <h4 style={{ fontSize: '0.95rem', margin: '0.5rem 0' }}>{booking.propertyTitle}</h4>
                <p style={{ fontSize: '0.8rem', color: '#666', margin: '0.3rem 0' }}>
                  <strong>{t.dates}:</strong> {booking.checkInDate} — {booking.checkOutDate}
                </p>
                <p style={{ fontSize: '0.8rem', color: '#666', margin: '0.3rem 0' }}>
                  <strong>{t.nights}:</strong> {booking.nights}
                </p>
                <p style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#d6b17d', margin: '0.5rem 0' }}>
                  {booking.totalPrice} AZN
                </p>
                <button
                  className="btn btn-sm"
                  style={{ marginTop: '0.5rem', width: '100%' }}
                  onClick={() => handleCancelBooking(booking.id)}
                  disabled={isCanceiling === booking.id}
                >
                  {isCanceiling === booking.id ? 'Canceling...' : t.cancel}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {activeSubTab === 'requests' && (
        <div className="bookings-grid">
          {incomingRequests.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', color: '#888' }}>
              {t.empty}
            </div>
          ) : (
            incomingRequests.map(booking => (
              <div key={booking.id} className="booking-request-card" style={{ border: '1px solid #d6b17d', borderRadius: '8px', padding: '1rem', backgroundColor: '#fffbf5' }}>
                {booking.propertyImage && (
                  <img src={booking.propertyImage} alt="property" style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '4px', marginBottom: '0.5rem' }} />
                )}
                <h4 style={{ fontSize: '0.95rem', margin: '0.5rem 0' }}>{booking.propertyTitle}</h4>
                
                <div style={{ backgroundColor: 'white', padding: '0.75rem', borderRadius: '4px', marginBottom: '0.5rem' }}>
                  <p style={{ fontSize: '0.8rem', color: '#666', margin: '0.3rem 0' }}>
                    <strong>{t.dates}:</strong> {booking.checkInDate} — {booking.checkOutDate}
                  </p>
                  <p style={{ fontSize: '0.8rem', color: '#666', margin: '0.3rem 0' }}>
                    <strong>{t.nights}:</strong> {booking.nights}
                  </p>
                  <p style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#d6b17d' }}>
                    {booking.totalPrice} AZN
                  </p>
                </div>

                <div style={{ backgroundColor: 'white', padding: '0.75rem', borderRadius: '4px' }}>
                  <p style={{ fontSize: '0.85rem', margin: '0.3rem 0' }}>
                    <strong>{t.guest}:</strong> {booking.userName}
                  </p>
                  <p style={{ fontSize: '0.8rem', color: '#666', margin: '0.3rem 0' }}>
                    {t.phone}: <a href={`tel:${booking.userPhone}`} style={{ color: '#1976d2', textDecoration: 'none' }}>{booking.userPhone}</a>
                  </p>
                  <p style={{ fontSize: '0.8rem', color: '#666', margin: '0.3rem 0' }}>
                    {t.email}: <a href={`mailto:${booking.userEmail}`} style={{ color: '#1976d2', textDecoration: 'none' }}>{booking.userEmail}</a>
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <style>{`
        .bookings-tab {
          padding: 1rem;
        }

        .bookings-tabs-header {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          border-bottom: 1px solid #e0e0e0;
        }

        .tab-button {
          padding: 0.75rem 1.25rem;
          background: none;
          border: none;
          border-bottom: 3px solid transparent;
          cursor: pointer;
          font-weight: 500;
          color: #666;
          transition: all 0.3s;
        }

        .tab-button:hover {
          color: #333;
        }

        .tab-button.active {
          color: #d6b17d;
          border-bottom-color: #d6b17d;
        }

        .bookings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1rem;
        }

        .booking-card, .booking-request-card {
          transition: box-shadow 0.3s, transform 0.3s;
        }

        .booking-card:hover, .booking-request-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          transform: translateY(-2px);
        }

        .btn {
          background: #d6b17d;
          color: #fff;
          border: none;
          border-radius: 4px;
          padding: 0.5rem 1rem;
          cursor: pointer;
          font-weight: 500;
          transition: background 0.3s;
        }

        .btn:hover:not(:disabled) {
          background: #c9a156;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-sm {
          padding: 0.4rem 0.8rem;
          font-size: 0.85rem;
        }

        .empty-state {
          text-align: center;
          padding: 2rem;
          font-size: 0.95rem;
        }

        @media (max-width: 768px) {
          .bookings-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
