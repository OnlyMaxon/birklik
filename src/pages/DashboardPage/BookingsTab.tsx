import React from 'react'
import { useLanguage, useAuth } from '../../context'
import { useNavigate } from 'react-router-dom'
import { Booking, Property } from '../../types'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { getUserBookings, cancelBooking, acceptBooking, rejectBooking, editBooking, deleteBooking } from '../../services'
import { createBookingApprovedNotification, createBookingRejectedNotification } from '../../services/notificationsService'
import { Loading } from '../../components'
import * as logger from '../../services/logger'

interface BookingWithProperty extends Booking {
  propertyTitle?: string
  propertyImage?: string
}

export const BookingsTab: React.FC = () => {
  const { language } = useLanguage()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeSubTab, setActiveSubTab] = React.useState<'my-bookings' | 'requests'>('my-bookings')
  const [myBookings, setMyBookings] = React.useState<BookingWithProperty[]>([])
  const [incomingRequests, setIncomingRequests] = React.useState<BookingWithProperty[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [actionInProgress, setActionInProgress] = React.useState<{ type: 'cancel' | 'accept' | 'reject'; bookingId: string } | null>(null)
  const [editingBookingId, setEditingBookingId] = React.useState<string | null>(null)
  const [editingDates, setEditingDates] = React.useState<{ checkIn: string; checkOut: string } | null>(null)
  const [sortBy, setSortBy] = React.useState<'date-newest' | 'date-oldest' | 'price-high' | 'price-low' | 'name'>('date-newest')

  const t = {
    myBookings: language === 'en' ? 'My Bookings' : language === 'ru' ? 'Мои Бронирования' : 'Mənim Bölmələrim',
    requests: language === 'en' ? 'Booking Requests' : language === 'ru' ? 'Запросы на Бронирование' : 'Bölmə Sorğuları',
    dates: language === 'en' ? 'Dates' : language === 'ru' ? 'Даты' : 'Tarix',
    nights: language === 'en' ? 'nights' : language === 'ru' ? 'ночи' : 'gecə',
    guest: language === 'en' ? 'Guest' : language === 'ru' ? 'Гость' : 'Qonaq',
    phone: language === 'en' ? 'Phone' : language === 'ru' ? 'Телефон' : 'Telefon',
    email: language === 'en' ? 'Email' : language === 'ru' ? 'Email' : 'Email',
    cancel: language === 'en' ? 'Cancel Booking' : language === 'ru' ? 'Отменить' : 'Ləğv Et',
    empty: language === 'en' ? 'No bookings yet' : language === 'ru' ? 'Нет бронирований' : 'Hələ bölmə yoxdur',
    status: language === 'en' ? 'Status' : language === 'ru' ? 'Статус' : 'Status',
    loading: language === 'en' ? 'Loading bookings...' : language === 'ru' ? 'Загрузка бронирований...' : 'Bölmələr yüklənir...',
    pending: language === 'en' ? 'Waiting' : language === 'ru' ? 'Ожидание' : 'Gözləmə',
    approved: language === 'en' ? 'Approved' : language === 'ru' ? 'Принято' : 'Qəbul edildi',
    rejected: language === 'en' ? 'Rejected' : language === 'ru' ? 'Отклонено' : 'Rədd edildi',
    accept: language === 'en' ? 'Accept' : language === 'ru' ? 'Принять' : 'Qəbul Et',
    reject: language === 'en' ? 'Reject' : language === 'ru' ? 'Отклонить' : 'Rədd Et',
    actionError: language === 'en' ? 'Failed to complete action' : language === 'ru' ? 'Не удалось выполнить действие' : 'Fəal tamamlana bilmədi',
    sort: language === 'en' ? 'Sort' : language === 'ru' ? 'Сортировка' : 'Sıralama',
    sortDateNewest: language === 'en' ? 'Date (newest first)' : language === 'ru' ? 'Дата (новие сначала)' : 'Tarix (yeni əvvəl)',
    sortDateOldest: language === 'en' ? 'Date (oldest first)' : language === 'ru' ? 'Дата (старые сначала)' : 'Tarix (eski əvvəl)',
    sortPriceHigh: language === 'en' ? 'Price (high to low)' : language === 'ru' ? 'Цена (выше)' : 'Qiymət (yüksəkdən aşağıya)',
    sortPriceLow: language === 'en' ? 'Price (low to high)' : language === 'ru' ? 'Цена (ниже)' : 'Qiymət (aşağıdan yüksəyə)',
    sortName: language === 'en' ? 'Name (A-Z)' : language === 'ru' ? 'Название (А-Я)' : 'Ad (A-Z)'
  }

  // Helper function to check if booking is completed (checkout date passed)
  const isBookingCompleted = (checkOutDate: string): boolean => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const checkOut = new Date(checkOutDate)
    checkOut.setHours(0, 0, 0, 0)
    return checkOut < today
  }

  // Helper function to get property title with fallback to other languages
  const getPropertyTitle = (property: Property | undefined): string => {
    if (!property?.title) return 'Property'
    // Try current language first
    if (property.title[language]) return property.title[language]
    // Fallback to other languages
    if (property.title['en']) return property.title['en']
    if (property.title['ru']) return property.title['ru']
    if (property.title['az']) return property.title['az']
    // Last resort
    return Object.values(property.title)[0] || 'Property'
  }

  // Helper function to sort bookings
  const sortBookings = (bookings: BookingWithProperty[]): BookingWithProperty[] => {
    const sorted = [...bookings]
    switch (sortBy) {
      case 'date-newest':
        return sorted.sort((a, b) => new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime())
      case 'date-oldest':
        return sorted.sort((a, b) => new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime())
      case 'price-high':
        return sorted.sort((a, b) => (b.totalPrice || 0) - (a.totalPrice || 0))
      case 'price-low':
        return sorted.sort((a, b) => (a.totalPrice || 0) - (b.totalPrice || 0))
      case 'name':
        return sorted.sort((a, b) => (a.propertyTitle || '').localeCompare(b.propertyTitle || ''))
      default:
        return sorted
    }
  }

  // Load my bookings (bookings user made as guest)
  const loadMyBookings = React.useCallback(async () => {
    if (!user?.id) return

    try {
      const bookings = await getUserBookings(user.id)
      const bookingsWithDetails: BookingWithProperty[] = []

      if (bookings.length === 0) {
        setMyBookings([])
        return
      }

      // Filter out rejected, cancelled, and completed bookings
      const activeBookings = bookings.filter(booking => {
        // Exclude rejected and cancelled bookings
        if (booking.status === 'rejected' || booking.status === 'cancelled') {
          return false
        }
        // Exclude completed bookings (checkout date passed)
        if (isBookingCompleted(booking.checkOutDate)) {
          return false
        }
        return true
      })

      if (activeBookings.length === 0) {
        setMyBookings([])
        return
      }

      // Get unique property IDs
      const uniquePropertyIds = [...new Set(activeBookings.map(b => b.propertyId))]
      const propsRef = collection(db, 'properties')
      const propertiesMap = new Map<string, Property>()

      // Batch fetch properties in chunks of 10 (Firestore `in` limit is 10)
      for (let i = 0; i < uniquePropertyIds.length; i += 10) {
        const chunk = uniquePropertyIds.slice(i, i + 10)
        const propsQuery = query(propsRef, where('__name__', 'in', chunk))
        const propsSnapshot = await getDocs(propsQuery)
        propsSnapshot.docs.forEach(d => {
          propertiesMap.set(d.id, d.data() as Property)
        })
      }

      // Combine bookings with property details - only if property exists
      activeBookings.forEach(booking => {
        const property = propertiesMap.get(booking.propertyId)
        // Skip bookings for deleted properties
        if (property) {
          bookingsWithDetails.push({
            ...booking,
            propertyTitle: getPropertyTitle(property),
            propertyImage: property?.images?.[0]
          })
        }
      })

      setMyBookings(bookingsWithDetails)
    } catch (err) {
      logger.error('Error loading my bookings:', err)
      setError(t.loading)
    }
  }, [user?.id, language])

  // Load incoming booking requests (all bookings on user's properties - not rejected)
  const loadIncomingRequests = React.useCallback(async () => {
    if (!user?.id) return

    try {
      const propsRef = collection(db, 'properties')
      const propsQuery = query(propsRef, where('ownerId', '==', user.id))
      const propsSnapshot = await getDocs(propsQuery)
      const propertyIds = propsSnapshot.docs.map(doc => doc.id)
      const propertiesMap = new Map(propsSnapshot.docs.map(d => [d.id, d.data() as Property]))

      if (propertyIds.length === 0) {
        setIncomingRequests([])
        return
      }

      const bookingsRef = collection(db, 'bookings')
      const allBookings: BookingWithProperty[] = []

      // Batch query bookings in chunks of 10 (Firestore 'in' limit)
      for (let i = 0; i < propertyIds.length; i += 10) {
        const chunk = propertyIds.slice(i, i + 10)
        const bookingsQuery = query(bookingsRef, where('propertyId', 'in', chunk))
        const bookingsSnap = await getDocs(bookingsQuery)

        bookingsSnap.docs.forEach(bookingDoc => {
          const booking = bookingDoc.data() as Omit<Booking, 'id'>
          // Filter out rejected, cancelled, and completed bookings
          if (booking.status !== 'rejected' && booking.status !== 'cancelled' && !isBookingCompleted(booking.checkOutDate)) {
            const property = propertiesMap.get(booking.propertyId)
            // Only add if property exists
            if (property) {
              allBookings.push({
                id: bookingDoc.id,
                ...booking,
                propertyTitle: getPropertyTitle(property),
                propertyImage: property?.images?.[0]
              })
            }
          }
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
    const confirmMsg = language === 'en' ? 'Are you sure?' : language === 'ru' ? 'Вы уверены?' : 'Əminsiniz?'
    if (!confirm(confirmMsg)) return

    try {
      setActionInProgress({ type: 'cancel', bookingId })
      const result = await cancelBooking(bookingId)
      if (result.success) {
        setMyBookings(prev => prev.filter(b => b.id !== bookingId))
        setError('')
      } else {
        setError(t.actionError)
      }
    } catch (err) {
      logger.error('Error canceling booking:', err)
      setError(t.actionError)
    } finally {
      setActionInProgress(null)
    }
  }

  const handleAcceptBooking = async (booking: BookingWithProperty) => {
    try {
      setActionInProgress({ type: 'accept', bookingId: booking.id })
      
      const updated = await acceptBooking(booking.id)
      if (updated) {
        // Send notification to guest
        await createBookingApprovedNotification(booking.userId, {
          type: 'bookingApproved',
          title: language === 'en' ? '✅ Your booking is approved!' : language === 'ru' ? '✅ Ваше бронирование принято!' : '✅ Sizin bölmə qəbul edildi!',
          message: language === 'en' ? 'Your booking has been approved by the property owner' : language === 'ru' ? 'Ваше бронирование одобрено владельцем' : 'Sizin bölmə sahibi tərəfindən qəbul edildi',
          read: false,
          bookingId: booking.id,
          propertyId: booking.propertyId,
          propertyTitle: booking.propertyTitle || '',
          checkInDate: booking.checkInDate,
          checkOutDate: booking.checkOutDate,
          ownerName: user?.name || ''
        })

        // Update the booking status in the list instead of removing
        setIncomingRequests(prev => prev.map(b => 
          b.id === booking.id ? { ...b, status: 'approved' } : b
        ))
        setError('')
      } else {
        setError(t.actionError)
      }
    } catch (err) {
      logger.error('Error accepting booking:', err)
      setError(t.actionError)
    } finally {
      setActionInProgress(null)
    }
  }

  const handleRejectBooking = async (booking: BookingWithProperty) => {
    const reason = language === 'en' ? 'Not available on these dates' : language === 'ru' ? 'Недоступно на эти даты' : 'Bu tarixlərdə əlçatan deyil'
    
    try {
      setActionInProgress({ type: 'reject', bookingId: booking.id })
      
      const updated = await rejectBooking(booking.id, reason)
      if (updated) {
        // Send notification to guest
        await createBookingRejectedNotification(booking.userId, {
          type: 'bookingRejected',
          title: language === 'en' ? '❌ Your booking was rejected' : language === 'ru' ? '❌ Ваше бронирование отклонено' : '❌ Sizin bölmə rədd edildi',
          message: language === 'en' ? 'The property owner declined your booking request' : language === 'ru' ? 'Владелец отклонил ваш запрос на бронирование' : 'Əmlak sahibi sizin bölmə sorğunuzu rədd etdi',
          read: false,
          bookingId: booking.id,
          propertyId: booking.propertyId,
          propertyTitle: booking.propertyTitle || '',
          checkInDate: booking.checkInDate,
          checkOutDate: booking.checkOutDate,
          ownerName: user?.name || '',
          rejectionReason: reason
        })

        // Remove from incoming requests
        setIncomingRequests(prev => prev.filter(b => b.id !== booking.id))
        // Also remove from my bookings if visible there
        setMyBookings(prev => prev.filter(b => b.id !== booking.id))
        setError('')
      } else {
        setError(t.actionError)
      }
    } catch (err) {
      logger.error('Error rejecting booking:', err)
      setError(t.actionError)
    } finally {
      setActionInProgress(null)
    }
  }

  const handleDeleteApprovedBooking = async (booking: BookingWithProperty) => {
    const confirmMsg = language === 'en' ? 'Delete this booking?' : language === 'ru' ? 'Удалить это бронирование?' : 'Bu bölməni silmək istəyirsiniz?'
    if (!confirm(confirmMsg)) return

    try {
      setActionInProgress({ type: 'reject', bookingId: booking.id })
      
      const success = await deleteBooking(booking.id)
      if (success) {
        // Remove from list
        setIncomingRequests(prev => prev.filter(b => b.id !== booking.id))
        setError('')
      } else {
        setError(t.actionError)
      }
    } catch (err) {
      logger.error('Error deleting booking:', err)
      setError(t.actionError)
    } finally {
      setActionInProgress(null)
    }
  }

  const handleEditApprovedBooking = (booking: BookingWithProperty) => {
    setEditingBookingId(booking.id)
    setEditingDates({
      checkIn: booking.checkInDate,
      checkOut: booking.checkOutDate
    })
  }

  const handleNavigateToProperty = (propertyId: string, e: React.MouseEvent<HTMLDivElement>) => {
    // Don't navigate if clicking on a button, input, or interactive element
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('input') || target.closest('textarea') || target.closest('a')) {
      return
    }
    navigate(`/property/${propertyId}`)
  }

  const handleSaveEditedBooking = async () => {
    if (!editingBookingId || !editingDates) return

    try {
      setActionInProgress({ type: 'accept', bookingId: editingBookingId })
      
      // Update the booking using service function
      const updated = await editBooking(editingBookingId, {
        checkInDate: editingDates.checkIn,
        checkOutDate: editingDates.checkOut
      } as Partial<Booking>)

      if (updated) {
        // Update in local state
        setIncomingRequests(prev => prev.map(b =>
          b.id === editingBookingId
            ? { ...b, checkInDate: editingDates.checkIn, checkOutDate: editingDates.checkOut }
            : b
        ))

        setEditingBookingId(null)
        setEditingDates(null)
        setError('')
      } else {
        setError(t.actionError)
      }
    } catch (err) {
      logger.error('Error updating booking dates:', err)
      setError(t.actionError)
    } finally {
      setActionInProgress(null)
    }
  }

  const getStatusComponent = (booking: Booking) => {
    let statusText = t.pending
    let statusColor = '#ff9800'

    if (booking.status === 'approved') {
      statusText = t.approved
      statusColor = '#4caf50'
    } else if (booking.status === 'rejected') {
      statusText = t.rejected
      statusColor = '#f44336'
    } else if (booking.status === 'cancelled') {
      statusText = language === 'en' ? 'Cancelled' : language === 'ru' ? 'Отменено' : 'Ləğv edildi'
      statusColor = '#999'
    }

    return (
      <div style={{
        display: 'inline-block',
        padding: '0.4rem 0.8rem',
        borderRadius: '20px',
        backgroundColor: `${statusColor}20`,
        color: statusColor,
        fontSize: '0.85rem',
        fontWeight: '500'
      }}>
        {statusText}
      </div>
    )
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
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: '500', color: '#666' }}>{t.sort}:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            style={{
              padding: '0.5rem 0.8rem',
              borderRadius: '4px',
              border: '1px solid #ddd',
              backgroundColor: '#fff',
              cursor: 'pointer',
              fontSize: '0.9rem',
              color: '#333'
            }}
          >
            <option value="date-newest">{t.sortDateNewest}</option>
            <option value="date-oldest">{t.sortDateOldest}</option>
            <option value="price-high">{t.sortPriceHigh}</option>
            <option value="price-low">{t.sortPriceLow}</option>
            <option value="name">{t.sortName}</option>
          </select>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {activeSubTab === 'my-bookings' && (
        <div className="bookings-grid">
          {myBookings.length === 0 ? (
            <div className="empty-state">{t.empty}</div>
          ) : (
            sortBookings(myBookings).map(booking => (
              <div 
                key={booking.id} 
                className="booking-card"
                onClick={(e) => handleNavigateToProperty(booking.propertyId, e as React.MouseEvent<HTMLDivElement>)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    navigate(`/property/${booking.propertyId}`)
                  }
                }}
              >
                {booking.propertyImage && (
                  <img src={booking.propertyImage} alt="property" className="booking-image" />
                )}
                <h4 className="booking-title">{booking.propertyTitle}</h4>
                
                <div className="booking-details">
                  <p>
                    <strong>{t.dates}:</strong> {booking.checkInDate} — {booking.checkOutDate}
                  </p>
                  <p>
                    <strong>{t.nights}:</strong> {booking.nights}
                  </p>
                  <p className="booking-price">
                    {booking.totalPrice} AZN
                  </p>
                </div>

                <div className="booking-status">
                  <strong>{t.status}:</strong> {getStatusComponent(booking)}
                </div>

                {booking.status === 'pending' && (
                  <button
                    className="btn btn-cancel"
                    onClick={() => handleCancelBooking(booking.id)}
                    disabled={actionInProgress?.bookingId === booking.id}
                  >
                    {actionInProgress?.bookingId === booking.id ? (
                      language === 'en' ? 'Canceling...' : language === 'ru' ? 'Отмена...' : 'Ləğv edilir...'
                    ) : t.cancel}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeSubTab === 'requests' && (
        <div className="bookings-grid">
          {incomingRequests.length === 0 ? (
            <div className="empty-state">{t.empty}</div>
          ) : (
            sortBookings(incomingRequests).map(booking => (
              <div 
                key={booking.id} 
                className="booking-request-card"
                onClick={(e) => handleNavigateToProperty(booking.propertyId, e as React.MouseEvent<HTMLDivElement>)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    navigate(`/property/${booking.propertyId}`)
                  }
                }}
              >
                {booking.propertyImage && (
                  <img src={booking.propertyImage} alt="property" className="booking-image" />
                )}
                <h4 className="booking-title">{booking.propertyTitle}</h4>
                
                <div className="booking-details">
                  {editingBookingId === booking.id && editingDates ? (
                    <>
                      <p>
                        <strong>{language === 'en' ? 'Check-in:' : language === 'ru' ? 'Заезд:' : 'Giriş:'}​</strong>
                        <input
                          type="date"
                          value={editingDates.checkIn}
                          onChange={(e) => setEditingDates({ ...editingDates, checkIn: e.target.value })}
                          style={{ marginLeft: '0.5rem', padding: '0.25rem' }}
                        />
                      </p>
                      <p>
                        <strong>{language === 'en' ? 'Check-out:' : language === 'ru' ? 'Выезд:' : 'Çıxış:'}​</strong>
                        <input
                          type="date"
                          value={editingDates.checkOut}
                          onChange={(e) => setEditingDates({ ...editingDates, checkOut: e.target.value })}
                          style={{ marginLeft: '0.5rem', padding: '0.25rem' }}
                        />
                      </p>
                    </>
                  ) : (
                    <>
                      <p>
                        <strong>{t.dates}:</strong> {booking.checkInDate} — {booking.checkOutDate}
                      </p>
                      <p>
                        <strong>{t.nights}:</strong> {booking.nights}
                      </p>
                      <p className="booking-price">
                        {booking.totalPrice} AZN
                      </p>
                    </>
                  )}
                </div>

                <div className="guest-info">
                  <h5>{t.guest}</h5>
                  <p><strong>{booking.userName}</strong></p>
                  <p>
                    {t.phone}: <a href={`tel:${booking.userPhone}`}>{booking.userPhone}</a>
                  </p>
                  <p>
                    {t.email}: <a href={`mailto:${booking.userEmail}`}>{booking.userEmail}</a>
                  </p>
                </div>

                <div className="booking-status">
                  <strong>{t.status}:</strong> {getStatusComponent(booking)}
                </div>

                <div className="booking-actions">
                  {booking.status === 'pending' && (
                    <>
                      <button
                        className="btn btn-accept"
                        onClick={() => handleAcceptBooking(booking)}
                        disabled={actionInProgress?.bookingId === booking.id}
                      >
                        {actionInProgress?.bookingId === booking.id && actionInProgress.type === 'accept' ? '...' : t.accept}
                      </button>
                      <button
                        className="btn btn-reject"
                        onClick={() => handleRejectBooking(booking)}
                        disabled={actionInProgress?.bookingId === booking.id}
                      >
                        {actionInProgress?.bookingId === booking.id && actionInProgress.type === 'reject' ? '...' : t.reject}
                      </button>
                    </>
                  )}
                  {booking.status === 'approved' && editingBookingId === booking.id && editingDates ? (
                    <>
                      <button
                        className="btn btn-accept"
                        onClick={handleSaveEditedBooking}
                        disabled={actionInProgress?.bookingId === booking.id}
                      >
                        {actionInProgress?.bookingId === booking.id ? '...' : (language === 'en' ? 'Save' : language === 'ru' ? 'Сохранить' : 'Saxla')}
                      </button>
                      <button
                        className="btn btn-ghost"
                        onClick={() => {
                          setEditingBookingId(null)
                          setEditingDates(null)
                        }}
                        disabled={actionInProgress?.bookingId === booking.id}
                      >
                        {language === 'en' ? 'Cancel' : language === 'ru' ? 'Отмена' : 'Ləğv Et'}
                      </button>
                    </>
                  ) : booking.status === 'approved' ? (
                    <>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleEditApprovedBooking(booking)}
                        title={language === 'en' ? 'Edit booking dates' : language === 'ru' ? 'Редактировать даты' : 'Bölmə tarixlərini redaktə et'}
                      >
                        ✏️ {language === 'en' ? 'Edit' : language === 'ru' ? 'Редактировать' : 'Redaktə Et'}
                      </button>
                      <button
                        className="btn btn-reject"
                        onClick={() => handleDeleteApprovedBooking(booking)}
                        disabled={actionInProgress?.bookingId === booking.id}
                        title={language === 'en' ? 'Delete this booking' : language === 'ru' ? 'Удалить бронирование' : 'Bölməni sil'}
                      >
                        {actionInProgress?.bookingId === booking.id ? '...' : (language === 'en' ? 'Delete' : language === 'ru' ? 'Удалить' : 'Sil')}
                      </button>
                    </>
                  ) : null}
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
          border-bottom: 2px solid #e0e0e0;
        }

        .tab-button {
          padding: 0.75rem 1.25rem;
          background: none;
          border: none;
          border-bottom: 3px solid transparent;
          cursor: pointer;
          font-weight: 500;
          color: #999;
          transition: all 0.3s;
          font-size: 0.95rem;
        }

        .tab-button:hover {
          color: #666;
        }

        .tab-button.active {
          color: #d6b17d;
          border-bottom-color: #d6b17d;
        }

        .bookings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.25rem;
        }

        .booking-card, .booking-request-card {
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 1rem;
          background: #fafafa;
          transition: all 0.3s ease;
          cursor: pointer;
        }

        .booking-card:hover, .booking-request-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          transform: translateY(-2px);
        }

        .booking-request-card {
          border-color: #d6b17d;
          background: #fffbf5;
        }

        .booking-image {
          width: 100%;
          height: 140px;
          object-fit: cover;
          border-radius: 6px;
          margin-bottom: 0.75rem;
        }

        .booking-title {
          font-size: 0.95rem;
          font-weight: 600;
          margin: 0.5rem 0;
          color: #333;
        }

        .booking-details {
          background: white;
          padding: 0.75rem;
          border-radius: 4px;
          margin-bottom: 0.75rem;
          font-size: 0.85rem;
        }

        .booking-details p {
          margin: 0.3rem 0;
          color: #666;
        }

        .booking-price {
          font-weight: 600 !important;
          color: #d6b17d !important;
          font-size: 0.95rem !important;
          margin-top: 0.5rem !important;
        }

        .booking-status {
          margin-bottom: 0.75rem;
          font-size: 0.85rem;
        }

        .guest-info {
          background: white;
          padding: 0.75rem;
          border-radius: 4px;
          margin-bottom: 0.75rem;
          font-size: 0.85rem;
        }

        .guest-info h5 {
          margin: 0 0 0.5rem 0;
          font-size: 0.9rem;
          color: #666;
        }

        .guest-info p {
          margin: 0.25rem 0;
          color: #666;
        }

        .guest-info a {
          color: #1976d2;
          text-decoration: none;
        }

        .guest-info a:hover {
          text-decoration: underline;
        }

        .booking-actions {
          display: flex;
          gap: 0.5rem;
        }

        .btn {
          flex: 1;
          padding: 0.5rem 0.75rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          font-size: 0.85rem;
          transition: all 0.3s ease;
        }

        .btn-cancel {
          background: #f5f5f5;
          color: #d32f2f;
          border: 1px solid #d32f2f;
        }

        .btn-cancel:hover:not(:disabled) {
          background: #d32f2f;
          color: white;
        }

        .btn-accept {
          background: #4caf50;
          color: white;
        }

        .btn-accept:hover:not(:disabled) {
          background: #45a049;
        }

        .btn-reject {
          background: #f44336;
          color: white;
        }

        .btn-reject:hover:not(:disabled) {
          background: #da190b;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .empty-state {
          grid-column: 1 / -1;
          text-align: center;
          padding: 3rem 1rem;
          color: #999;
          font-size: 0.95rem;
        }

        .error-message {
          background: #ffebee;
          color: #d32f2f;
          padding: 0.75rem 1rem;
          border-radius: 4px;
          margin-bottom: 1rem;
          font-size: 0.9rem;
        }

        @media (max-width: 768px) {
          .bookings-grid {
            grid-template-columns: 1fr;
          }

          .booking-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  )
}
