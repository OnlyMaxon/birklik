import React from 'react'
import { useLanguage, useAuth } from '../../context'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Booking, Property } from '../../types'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { getUserBookings, cancelBooking, acceptBooking, rejectBooking, editBooking, deleteBooking } from '../../services'
import { createBookingApprovedNotification, createBookingRejectedNotification } from '../../services/notificationsService'
import { Loading } from '../../components'
import * as logger from '../../services/logger'
import './BookingsTab.css'

interface BookingWithProperty extends Booking {
  propertyTitle?: string
  propertyImage?: string
}

const IconCalendar = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)

const IconMoon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)

const IconTag = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
)

const IconPhone = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.1a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
)

const IconMail = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
  </svg>
)

const IconCheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const IconEdit = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

const IconTrash = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)

const IconPhoto = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
  </svg>
)

const StatusDot = () => (
  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block', flexShrink: 0 }} />
)

export const BookingsTab: React.FC = () => {
  const { language } = useLanguage()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const subtabParam = searchParams.get('subtab') as 'my-bookings' | 'requests' | null
  const [activeSubTab, setActiveSubTab] = React.useState<'my-bookings' | 'requests'>(subtabParam || 'my-bookings')
  const [myBookings, setMyBookings] = React.useState<BookingWithProperty[]>([])
  const [incomingRequests, setIncomingRequests] = React.useState<BookingWithProperty[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [actionInProgress, setActionInProgress] = React.useState<{ type: 'cancel' | 'accept' | 'reject'; bookingId: string } | null>(null)
  const [editingBookingId, setEditingBookingId] = React.useState<string | null>(null)
  const [editingDates, setEditingDates] = React.useState<{ checkIn: string; checkOut: string } | null>(null)
  const [sortBy, setSortBy] = React.useState<'date-newest' | 'date-oldest' | 'price-high' | 'price-low' | 'name'>('date-newest')

  const t = {
    myBookings: language === 'en' ? 'My Bookings' : language === 'ru' ? 'Мои Бронирования' : 'Mənim bronlarım',
    requests: language === 'en' ? 'Booking Requests' : language === 'ru' ? 'Запросы на Бронирование' : 'Gələn sorğular',
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
    cancelled: language === 'en' ? 'Cancelled' : language === 'ru' ? 'Отменено' : 'Ləğv edildi',
    cancellationRequested: language === 'en' ? 'Cancellation Requested' : language === 'ru' ? 'Отправлено' : 'Ləğv edilmə istənib',
    cancellationSent: language === 'en' ? 'Cancellation sent' : language === 'ru' ? 'Запрос отправлен' : 'Sorğu göndərildi',
    accept: language === 'en' ? 'Accept' : language === 'ru' ? 'Принять' : 'Qəbul Et',
    reject: language === 'en' ? 'Reject' : language === 'ru' ? 'Отклонить' : 'Rədd Et',
    save: language === 'en' ? 'Save' : language === 'ru' ? 'Сохранить' : 'Saxla',
    edit: language === 'en' ? 'Edit' : language === 'ru' ? 'Изменить' : 'Redaktə Et',
    delete: language === 'en' ? 'Delete' : language === 'ru' ? 'Удалить' : 'Sil',
    cancelEdit: language === 'en' ? 'Cancel' : language === 'ru' ? 'Отмена' : 'Ləğv Et',
    checkIn: language === 'en' ? 'Check-in' : language === 'ru' ? 'Заезд' : 'Giriş',
    checkOut: language === 'en' ? 'Check-out' : language === 'ru' ? 'Выезд' : 'Çıxış',
    actionError: language === 'en' ? 'Failed to complete action' : language === 'ru' ? 'Не удалось выполнить действие' : 'Fəal tamamlana bilmədi',
    sort: language === 'en' ? 'Sort' : language === 'ru' ? 'Сортировка' : 'Sıralama',
    sortDateNewest: language === 'en' ? 'Date (newest first)' : language === 'ru' ? 'Дата (новие сначала)' : 'Tarix (yeni əvvəl)',
    sortDateOldest: language === 'en' ? 'Date (oldest first)' : language === 'ru' ? 'Дата (старые сначала)' : 'Tarix (eski əvvəl)',
    sortPriceHigh: language === 'en' ? 'Price (high to low)' : language === 'ru' ? 'Цена (выше)' : 'Qiymət (yüksəkdən aşağıya)',
    sortPriceLow: language === 'en' ? 'Price (low to high)' : language === 'ru' ? 'Цена (ниже)' : 'Qiymət (aşağıdan yüksəyə)',
    sortName: language === 'en' ? 'Name (A-Z)' : language === 'ru' ? 'Название (А-Я)' : 'Ad (A-Z)',
    canceling: language === 'en' ? 'Canceling...' : language === 'ru' ? 'Отмена...' : 'Ləğv edilir...'
  }

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'approved': return t.approved
      case 'rejected': return t.rejected
      case 'cancelled': return t.cancelled
      case 'cancellation_requested': return t.cancellationRequested
      default: return t.pending
    }
  }

  const isBookingCompleted = (checkOutDate: string): boolean => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const checkOut = new Date(checkOutDate)
    checkOut.setHours(0, 0, 0, 0)
    return checkOut < today
  }

  const getPropertyTitle = (property: Property | undefined): string => {
    if (!property?.title) return 'Property'
    if (property.title[language]) return property.title[language]
    if (property.title['en']) return property.title['en']
    if (property.title['ru']) return property.title['ru']
    if (property.title['az']) return property.title['az']
    return Object.values(property.title)[0] || 'Property'
  }

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

  const loadMyBookings = React.useCallback(async () => {
    if (!user?.id) return

    try {
      const bookings = await getUserBookings(user.id)
      const bookingsWithDetails: BookingWithProperty[] = []

      if (bookings.length === 0) {
        setMyBookings([])
        return
      }

      const activeBookings = bookings.filter(booking => {
        if (booking.status === 'rejected' || booking.status === 'cancelled') return false
        if (isBookingCompleted(booking.checkOutDate)) return false
        return true
      })

      if (activeBookings.length === 0) {
        setMyBookings([])
        return
      }

      const uniquePropertyIds = [...new Set(activeBookings.map(b => b.propertyId))]
      const propsRef = collection(db, 'properties')
      const propertiesMap = new Map<string, Property>()

      for (let i = 0; i < uniquePropertyIds.length; i += 10) {
        const chunk = uniquePropertyIds.slice(i, i + 10)
        const propsQuery = query(propsRef, where('__name__', 'in', chunk))
        const propsSnapshot = await getDocs(propsQuery)
        propsSnapshot.docs.forEach(d => {
          propertiesMap.set(d.id, d.data() as Property)
        })
      }

      activeBookings.forEach(booking => {
        const property = propertiesMap.get(booking.propertyId)
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

      for (let i = 0; i < propertyIds.length; i += 10) {
        const chunk = propertyIds.slice(i, i + 10)
        const bookingsQuery = query(bookingsRef, where('propertyId', 'in', chunk))
        const bookingsSnap = await getDocs(bookingsQuery)

        bookingsSnap.docs.forEach(bookingDoc => {
          const booking = bookingDoc.data() as Omit<Booking, 'id'>
          if (booking.status !== 'rejected' && booking.status !== 'cancelled' && !isBookingCompleted(booking.checkOutDate)) {
            const property = propertiesMap.get(booking.propertyId)
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
        setMyBookings(prev => prev.map(b =>
          b.id === bookingId ? { ...b, status: 'cancellation_requested' } : b
        ))
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
        setIncomingRequests(prev => prev.filter(b => b.id !== booking.id))
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
    setEditingDates({ checkIn: booking.checkInDate, checkOut: booking.checkOutDate })
  }

  const handleNavigateToProperty = (propertyId: string, e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('input') || target.closest('textarea') || target.closest('a')) return
    navigate(`/property/${propertyId}`)
  }

  const handleSaveEditedBooking = async () => {
    if (!editingBookingId || !editingDates) return

    try {
      setActionInProgress({ type: 'accept', bookingId: editingBookingId })
      const updated = await editBooking(editingBookingId, {
        checkInDate: editingDates.checkIn,
        checkOutDate: editingDates.checkOut
      } as Partial<Booking>)

      if (updated) {
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

  if (isLoading) {
    return <Loading message={t.loading} />
  }

  const emptyState = (
    <div className="bookings-empty">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      <p>{t.empty}</p>
    </div>
  )

  const imagePlaceholder = (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-300)' }}>
      <IconPhoto />
    </div>
  )

  return (
    <div className="bookings-tab">
      <div className="bookings-header">
        <div className="bookings-subtabs">
          <button
            className={`bookings-subtab${activeSubTab === 'my-bookings' ? ' active' : ''}`}
            onClick={() => setActiveSubTab('my-bookings')}
          >
            {t.myBookings}
          </button>
          <button
            className={`bookings-subtab${activeSubTab === 'requests' ? ' active' : ''}`}
            onClick={() => setActiveSubTab('requests')}
          >
            {t.requests}
          </button>
        </div>

        <div className="bookings-sort">
          <span className="bookings-sort-label">{t.sort}:</span>
          <select
            className="bookings-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          >
            <option value="date-newest">{t.sortDateNewest}</option>
            <option value="date-oldest">{t.sortDateOldest}</option>
            <option value="price-high">{t.sortPriceHigh}</option>
            <option value="price-low">{t.sortPriceLow}</option>
            <option value="name">{t.sortName}</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bookings-error">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      <div className="bookings-grid">
        {activeSubTab === 'my-bookings' && (
          myBookings.length === 0 ? emptyState : (
            sortBookings(myBookings).map(booking => (
              <div
                key={booking.id}
                className="booking-card"
                onClick={(e) => handleNavigateToProperty(booking.propertyId, e as React.MouseEvent<HTMLDivElement>)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/property/${booking.propertyId}`) }}
              >
                <div className="booking-card__img-wrap">
                  {booking.propertyImage
                    ? <img src={booking.propertyImage} alt="" className="booking-card__img" />
                    : imagePlaceholder
                  }
                  <span className={`booking-status-badge booking-status-badge--${booking.status}`}>
                    <StatusDot />
                    {getStatusLabel(booking.status)}
                  </span>
                </div>

                <div className="booking-card__body">
                  <h4 className="booking-card__title">{booking.propertyTitle}</h4>

                  <div className="booking-card__info">
                    <div className="booking-card__info-row">
                      <IconCalendar />
                      {booking.checkInDate} — {booking.checkOutDate}
                    </div>
                    <div className="booking-card__info-row">
                      <IconMoon />
                      {booking.nights} {t.nights}
                    </div>
                    <div className="booking-card__info-row">
                      <IconTag />
                      <span className="booking-card__info-price">
                        {booking.totalPrice} AZN
                      </span>
                    </div>
                  </div>

                  {booking.status === 'cancellation_requested' && (
                    <div className="booking-sent-badge">
                      <IconCheck />
                      {t.cancellationSent}
                    </div>
                  )}

                  {booking.status === 'pending' && (
                    <div className="booking-card__actions">
                      <button
                        className="bk-btn bk-btn--cancel"
                        onClick={() => handleCancelBooking(booking.id)}
                        disabled={actionInProgress?.bookingId === booking.id}
                      >
                        {actionInProgress?.bookingId === booking.id ? t.canceling : t.cancel}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )
        )}

        {activeSubTab === 'requests' && (
          incomingRequests.length === 0 ? emptyState : (
            sortBookings(incomingRequests).map(booking => (
              <div
                key={booking.id}
                className="booking-card booking-card--request"
                onClick={(e) => handleNavigateToProperty(booking.propertyId, e as React.MouseEvent<HTMLDivElement>)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/property/${booking.propertyId}`) }}
              >
                <div className="booking-card__img-wrap">
                  {booking.propertyImage
                    ? <img src={booking.propertyImage} alt="" className="booking-card__img" />
                    : imagePlaceholder
                  }
                  <span className={`booking-status-badge booking-status-badge--${booking.status}`}>
                    <StatusDot />
                    {getStatusLabel(booking.status)}
                  </span>
                </div>

                <div className="booking-card__body">
                  <h4 className="booking-card__title">{booking.propertyTitle}</h4>

                  <div className="booking-card__info">
                    {editingBookingId === booking.id && editingDates ? (
                      <div className="booking-card__date-edit">
                        <div className="booking-card__date-field">
                          <label>{t.checkIn}</label>
                          <input
                            type="date"
                            value={editingDates.checkIn}
                            onChange={(e) => setEditingDates({ ...editingDates, checkIn: e.target.value })}
                          />
                        </div>
                        <div className="booking-card__date-field">
                          <label>{t.checkOut}</label>
                          <input
                            type="date"
                            value={editingDates.checkOut}
                            onChange={(e) => setEditingDates({ ...editingDates, checkOut: e.target.value })}
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="booking-card__info-row">
                          <IconCalendar />
                          {booking.checkInDate} — {booking.checkOutDate}
                        </div>
                        <div className="booking-card__info-row">
                          <IconMoon />
                          {booking.nights} {t.nights}
                        </div>
                        <div className="booking-card__info-row">
                          <IconTag />
                          <span className="booking-card__info-price">
                            {booking.totalPrice} AZN
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="booking-card__guest">
                    <span className="booking-card__guest-label">{t.guest}</span>
                    <span className="booking-card__guest-name">{booking.userName}</span>
                    {booking.userPhone && (
                      <div className="booking-card__guest-row">
                        <IconPhone />
                        <a href={`tel:${booking.userPhone}`}>{booking.userPhone}</a>
                      </div>
                    )}
                    {booking.userEmail && (
                      <div className="booking-card__guest-row">
                        <IconMail />
                        <a href={`mailto:${booking.userEmail}`}>{booking.userEmail}</a>
                      </div>
                    )}
                  </div>

                  <div className="booking-card__actions">
                    {booking.status === 'pending' && (
                      <>
                        <button
                          className="bk-btn bk-btn--accept"
                          onClick={() => handleAcceptBooking(booking)}
                          disabled={actionInProgress?.bookingId === booking.id}
                        >
                          {actionInProgress?.bookingId === booking.id && actionInProgress.type === 'accept' ? '...' : t.accept}
                        </button>
                        <button
                          className="bk-btn bk-btn--reject"
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
                          className="bk-btn bk-btn--accept"
                          onClick={handleSaveEditedBooking}
                          disabled={actionInProgress?.bookingId === booking.id}
                        >
                          {actionInProgress?.bookingId === booking.id ? '...' : t.save}
                        </button>
                        <button
                          className="bk-btn bk-btn--ghost"
                          onClick={() => { setEditingBookingId(null); setEditingDates(null) }}
                          disabled={actionInProgress?.bookingId === booking.id}
                        >
                          {t.cancelEdit}
                        </button>
                      </>
                    ) : booking.status === 'approved' ? (
                      <>
                        <button
                          className="bk-btn bk-btn--edit"
                          onClick={() => handleEditApprovedBooking(booking)}
                        >
                          <IconEdit />
                          {t.edit}
                        </button>
                        <button
                          className="bk-btn bk-btn--reject"
                          onClick={() => handleDeleteApprovedBooking(booking)}
                          disabled={actionInProgress?.bookingId === booking.id}
                        >
                          {actionInProgress?.bookingId === booking.id ? '...' : (
                            <><IconTrash />{t.delete}</>
                          )}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  )
}
