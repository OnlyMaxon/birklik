import React from 'react'
import { useLanguage, useAuth } from '../../context'
import { Property, Booking } from '../../types'
import { createBooking, cancelBooking } from '../../services'
import { getCsrfToken } from '../../services/csrfService'
import * as logger from '../../services/logger'

interface CalendarCell {
  label: string
  dateISO?: string
  inMonth: boolean
}

interface PropertyBookingProps {
  property: Property
  onBookingSuccess?: () => void
}

const toISODate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const buildCalendarCells = (monthDate: Date): CalendarCell[] => {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const startWeekDay = (firstDay.getDay() + 6) % 7
  const startDate = new Date(firstDay)
  startDate.setDate(firstDay.getDate() - startWeekDay)

  const cells: CalendarCell[] = []
  for (let i = 0; i < 42; i += 1) {
    const current = new Date(startDate)
    current.setDate(startDate.getDate() + i)
    cells.push({
      label: String(current.getDate()),
      dateISO: toISODate(current),
      inMonth: current.getMonth() === monthDate.getMonth()
    })
  }

  return cells
}

/**
 * PropertyBooking Component - Displays booking calendar and handles property bookings
 * @component
 * @param {PropertyBookingProps} props - Component props
 * @returns {React.ReactElement} Rendered booking section
 * @example
 * <PropertyBooking property={property} onBookingSuccess={refresh} />
 */
export const PropertyBooking: React.FC<PropertyBookingProps> = ({ property, onBookingSuccess }) => {
  const { language, t } = useLanguage()
  const { isAuthenticated, user } = useAuth()
  const [selectedCheckIn, setSelectedCheckIn] = React.useState('')
  const [selectedCheckOut, setSelectedCheckOut] = React.useState('')
  const [displayMonth, setDisplayMonth] = React.useState(() => new Date())
  const [isBooking, setIsBooking] = React.useState(false)
  const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [lastBookingId, setLastBookingId] = React.useState<string | null>(null)
  const bookingTimeoutRef = React.useRef<number | null>(null)

  const getTodayISO = () => new Date().toISOString().split('T')[0]

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (bookingTimeoutRef.current) clearTimeout(bookingTimeoutRef.current)
    }
  }, [])

  // Effects removed - debug logs removed

  const handleCancelBooking = async () => {
    if (!lastBookingId) {
      return
    }
    
    try {
      const result = await cancelBooking(lastBookingId)
      if (result.success) {
        setMessage({ type: 'success', text: language === 'en' ? 'Cancellation request sent' : language === 'ru' ? 'Запрос на отмену отправлен' : 'İptal sorğusu göndərildi' })
        setLastBookingId(null)
        onBookingSuccess?.()
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: language === 'en' ? 'Failed to cancel booking' : language === 'ru' ? 'Ошибка отмены' : 'İptal edilə bilmədi' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: language === 'en' ? 'Cancellation error' : language === 'ru' ? 'Ошибка отмены' : 'İptal xətası' })
      logger.error('Cancel error:', error)
    }
  }

  const handleBookProperty = async () => {
    if (!isAuthenticated || !user || !selectedCheckIn || !selectedCheckOut) {
      setMessage({ type: 'error', text: language === 'en' ? 'Please fill all fields' : language === 'ru' ? 'Пожалуйста, заполните все поля' : 'Lütfən bütün sahələri doldurun' })
      return
    }

    const checkInDate = new Date(selectedCheckIn)
    const checkOutDate = new Date(selectedCheckOut)

    if (checkOutDate <= checkInDate) {
      setMessage({ type: 'error', text: language === 'en' ? 'Check-out must be after check-in' : language === 'ru' ? 'Выезд должен быть после приезда' : 'Çıkış tarixi giriş tarixindən sonra olmalıdır' })
      return
    }

    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))
    const totalPrice = (property.price?.daily || 0) * nights

    const booking: Omit<Booking, 'id' | 'createdAt'> = {
      propertyId: property.id,
      userId: user.id,
      ownerId: property.ownerId || '',
      userName: user.name || 'Guest',
      userEmail: user.email || '',
      userPhone: user.phone || '',
      checkInDate: selectedCheckIn,
      checkOutDate: selectedCheckOut,
      nights,
      totalPrice,
      status: 'pending'
    }

    // Prevent double submission
    if (isBooking) {
      return
    }
    
    setIsBooking(true)
    
    // Safety timeout to prevent hanging
    const timeoutId = window.setTimeout(() => {
      setIsBooking(false)
      setMessage({ type: 'error', text: language === 'en' ? 'Request timeout' : language === 'ru' ? 'Время ожидания истекло' : 'Sorğu zaman aşımı' })
    }, 15000)
    
    bookingTimeoutRef.current = timeoutId
    
    try {
      const csrfToken = getCsrfToken()
      const createdBooking = await createBooking(booking, csrfToken)
      
      // Cancel the timeout if request succeeded
      if (bookingTimeoutRef.current) {
        clearTimeout(bookingTimeoutRef.current)
      }
      
      if (createdBooking?.id) {
        setLastBookingId(createdBooking.id)
        setMessage({ type: 'success', text: language === 'en' ? 'Request sent!' : language === 'ru' ? 'Запрос отправлен!' : 'Sorgu gonderildi!' })
        // Clear dates to reset form
        setSelectedCheckIn('')
        setSelectedCheckOut('')
        // Callback to refresh parent data
        onBookingSuccess?.()
        setTimeout(() => {
          setMessage(null)
        }, 3000)
      } else {
        setMessage({ type: 'error', text: language === 'en' ? 'Dates conflict or booking error' : language === 'ru' ? 'Эти даты уже забронированы или ошибка' : 'Tarixlər əvvəldən qeydiyyatdadır' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: language === 'en' ? 'Booking error' : language === 'ru' ? 'Ошибка бронирования' : 'Rezervasyon xətası' })
      logger.error('Booking error:', error)
    } finally {
      setIsBooking(false)
      if (bookingTimeoutRef.current) {
        clearTimeout(bookingTimeoutRef.current)
      }
    }
  }

  const calendarCells = buildCalendarCells(displayMonth)
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const dayNames = language === 'en' ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] : language === 'ru' ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] : ['B', 'Ç', 'Ş', 'P', 'C', 'Ş', 'B']

  const isCellDisabled = (dateISO?: string) => {
    if (!dateISO) return false
    
    // Блокировать прошлые даты
    const today = getTodayISO()
    if (dateISO < today) return true
    
    // Блокировать забронированные/недоступные даты
    if (property.unavailableFrom && property.unavailableTo) {
      const cellDate = dateISO
      if (cellDate >= property.unavailableFrom && cellDate <= property.unavailableTo) {
        return true
      }
    }
    
    return false
  }

  return (
    <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f8f9fa', borderRadius: '8px' }}>
      <h2 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '1.5rem' }}>
        {language === 'en' ? 'Book Now' : language === 'ru' ? 'Забронировать' : 'İndi Rezerv Edin'}
      </h2>

      {message && (
        <div style={{
          padding: '0.75rem 1rem',
          background: message.type === 'success' ? '#d4edda' : '#f8d7da',
          color: message.type === 'success' ? '#155724' : '#721c24',
          borderRadius: '6px',
          marginBottom: '1rem',
          fontSize: '0.9rem'
        }}>
          {message.text}
        </div>
      )}

      {/* Calendar */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <button onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1))} style={{ padding: '0.5rem', border: 'none', background: '#ddd', borderRadius: '4px', cursor: 'pointer' }}>←</button>
          <h3 style={{ margin: 0 }}>{monthNames[displayMonth.getMonth()]} {displayMonth.getFullYear()}</h3>
          <button onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1))} style={{ padding: '0.5rem', border: 'none', background: '#ddd', borderRadius: '4px', cursor: 'pointer' }}>→</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '1rem' }}>
          {dayNames.map(day => (
            <div key={day} style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.85rem', color: '#666', padding: '0.5rem' }}>
              {day}
            </div>
          ))}
          {calendarCells.map((cell, idx) => (
            <button
              key={idx}
              onClick={() => {
                if (!isCellDisabled(cell.dateISO)) {
                  if (!selectedCheckIn) setSelectedCheckIn(cell.dateISO || '')
                  else if (!selectedCheckOut) setSelectedCheckOut(cell.dateISO || '')
                }
              }}
              style={{
                padding: '0.5rem',
                border: '1px solid #ddd',
                background: cell.dateISO === selectedCheckIn || cell.dateISO === selectedCheckOut ? '#27ae60' : cell.inMonth ? 'white' : '#f0f0f0',
                color: cell.dateISO === selectedCheckIn || cell.dateISO === selectedCheckOut ? 'white' : cell.inMonth ? '#333' : '#999',
                borderRadius: '4px',
                cursor: isCellDisabled(cell.dateISO) ? 'not-allowed' : 'pointer',
                opacity: isCellDisabled(cell.dateISO) ? 0.5 : 1,
                fontSize: '0.85rem'
              }}
              disabled={isCellDisabled(cell.dateISO)}
            >
              {cell.label}
            </button>
          ))}
        </div>
      </div>

      {/* Booking Form */}
      <div style={{ marginBottom: '1.5rem' }}>
        <input
          type="date"
          min={getTodayISO()}
          value={selectedCheckIn}
          onChange={e => setSelectedCheckIn(e.target.value)}
          style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '6px', marginBottom: '0.75rem', fontSize: '0.95rem' }}
          placeholder={language === 'en' ? 'Check-in' : language === 'ru' ? 'Заезд' : 'Giriş'}
        />
        <input
          type="date"
          min={getTodayISO()}
          value={selectedCheckOut}
          onChange={e => setSelectedCheckOut(e.target.value)}
          style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '6px', marginBottom: '0.75rem', fontSize: '0.95rem' }}
          placeholder={language === 'en' ? 'Check-out' : language === 'ru' ? 'Выезд' : 'Çıxış'}
        />
      </div>

      {/* Price Summary */}
      {selectedCheckIn && selectedCheckOut && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'white', borderRadius: '6px' }}>
          <p style={{ margin: '0 0 0.5rem 0', color: '#666' }}>
            {Math.ceil((new Date(selectedCheckOut).getTime() - new Date(selectedCheckIn).getTime()) / (1000 * 60 * 60 * 24))} {t.property.perNight}
          </p>
          <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 600, color: '#27ae60' }}>
            ${(property.price?.daily || 0) * Math.ceil((new Date(selectedCheckOut).getTime() - new Date(selectedCheckIn).getTime()) / (1000 * 60 * 60 * 24))}
          </p>
        </div>
      )}

      {/* Book Button */}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={handleBookProperty}
          disabled={!isAuthenticated || !selectedCheckIn || !selectedCheckOut || isBooking}
          style={{
            flex: 1,
            padding: '0.75rem',
            background: isAuthenticated ? '#27ae60' : '#bdc3c7',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: isAuthenticated && selectedCheckIn && selectedCheckOut ? 'pointer' : 'not-allowed',
            transition: 'opacity 0.3s'
          }}
        >
          {isAuthenticated ? (isBooking ? '...' : language === 'en' ? 'Confirm Booking' : language === 'ru' ? 'Подтвердить' : 'Təsdiqlə') : language === 'en' ? 'Sign in to book' : language === 'ru' ? 'Войдите, чтобы забронировать' : 'Rezerv etmək üçün daxil olun'}
        </button>
        
        {lastBookingId && (
          <button
            onClick={handleCancelBooking}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: '#e74c3c',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.3s'
            }}
          >
            {language === 'en' ? 'Cancel Booking' : language === 'ru' ? 'Отменить' : 'Ləğv et'}
          </button>
        )}
      </div>
    </div>
  )
}
