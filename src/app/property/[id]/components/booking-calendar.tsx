'use client'

import React from 'react'
import {useLanguage} from '@/components/providers'
import {InlineSpinner} from '@/components'
import {useNavigate} from '@/lib/navigation'
import type {Booking} from '@birklik/core/types'
import {createBookingAction} from '../actions'
import {buildCalendarCells, getTodayISO} from '../lib/calendar'

/**
 * Какие брони занимают даты.
 *
 * Ожидающие ответа владельца — тоже занимают. Сервер при создании брони отбивает
 * пересечение и с `approved`, и с `pending`, а календарь закрашивал только
 * подтверждённые: дата выглядела свободной, человек выбирал её, жал «Отправить» и
 * получал отказ «эти даты уже заняты».
 */
const BLOCKING_STATUSES: ReadonlyArray<Booking['status']> = ['approved', 'pending']

const blocksDate = (booking: Booking, dateISO: string): boolean =>
  BLOCKING_STATUSES.includes(booking.status)
  && dateISO >= booking.checkInDate
  && dateISO < booking.checkOutDate

interface BookingCalendarProps {
  propertyId: string
  dailyPrice: number
  currency: string
  isActive?: boolean
  unavailableFrom?: string
  unavailableTo?: string
  bookings: Booking[]
  isAuthenticated: boolean
  initialHasBooked: boolean
}

export function BookingCalendar({
  propertyId,
  dailyPrice,
  currency,
  isActive,
  unavailableFrom,
  unavailableTo,
  bookings,
  isAuthenticated,
  initialHasBooked
}: BookingCalendarProps) {
  const {language, t} = useLanguage()
  const navigate = useNavigate()

  const [displayMonth, setDisplayMonth] = React.useState(() => new Date())
  const [selectedCheckIn, setSelectedCheckIn] = React.useState('')
  const [selectedCheckOut, setSelectedCheckOut] = React.useState('')
  const [hasBooked, setHasBooked] = React.useState(initialHasBooked)
  const [isBooking, setIsBooking] = React.useState(false)
  const [notificationMessage, setNotificationMessage] = React.useState('')
  const [showNotification, setShowNotification] = React.useState(false)

  React.useEffect(() => {
    if (!showNotification) return
    const timer = setTimeout(() => setShowNotification(false), 3000)
    return () => clearTimeout(timer)
  }, [showNotification])

  const currencySymbol = (code: string) => (code === 'AZN' ? '₼' : code)

  const formatDate = (value?: string) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : language === 'ru' ? 'ru-RU' : 'az-Latn-AZ').format(date)
  }

  const isCellDisabled = (dateISO?: string) => {
    if (!dateISO) return false
    const today = getTodayISO()
    if (dateISO < today) return true

    if (unavailableFrom && unavailableTo && dateISO >= unavailableFrom && dateISO <= unavailableTo) {
      return true
    }

    return bookings.some(booking => blocksDate(booking, dateISO))
  }

  const isDateInSelectedRange = (dateISO: string | undefined, checkIn: string, checkOut: string) => {
    if (!dateISO) return false
    return dateISO >= checkIn && dateISO <= checkOut
  }

  const handleCalendarDateClick = (dateISO: string | undefined) => {
    if (!dateISO) return
    const today = getTodayISO()
    if (dateISO < today) {
      setNotificationMessage(t.property.cannotSelectPastDates)
      setShowNotification(true)
      return
    }

    if (isCellDisabled(dateISO)) {
      setNotificationMessage(t.property.dateNotAvailable)
      setShowNotification(true)
      return
    }

    if (!selectedCheckIn) {
      setSelectedCheckIn(dateISO)
      return
    }

    if (!selectedCheckOut) {
      if (dateISO < selectedCheckIn) {
        setSelectedCheckOut(selectedCheckIn)
        setSelectedCheckIn(dateISO)
      } else {
        setSelectedCheckOut(dateISO)
      }
      return
    }

    setSelectedCheckIn(dateISO)
    setSelectedCheckOut('')
  }

  const handlePrevMonth = () => {
    setDisplayMonth(prev => {
      const newMonth = new Date(prev)
      newMonth.setMonth(newMonth.getMonth() - 1)
      return newMonth
    })
  }

  const handleNextMonth = () => {
    setDisplayMonth(prev => {
      const newMonth = new Date(prev)
      newMonth.setMonth(newMonth.getMonth() + 1)
      return newMonth
    })
  }

  const handleMakeBooking = async () => {
    if (!isAuthenticated) {
      setNotificationMessage(t.property.signInBook)
      setShowNotification(true)
      navigate('/login')
      return
    }
    if (!selectedCheckIn || !selectedCheckOut) {
      setNotificationMessage(t.property.errorSelectDates)
      setShowNotification(true)
      return
    }

    setIsBooking(true)
    const result = await createBookingAction(propertyId, selectedCheckIn, selectedCheckOut)

    if (result.success) {
      setHasBooked(true)
      setSelectedCheckIn('')
      setSelectedCheckOut('')

      setNotificationMessage(
        language === 'en'
          ? 'Your booking has been added to your cabinet'
          : language === 'ru'
            ? 'Ваше бронирование добавлено в ваш кабинет'
            : 'Sizin sifariş siz kabinetinizə əlavə edildI'
      )
      setShowNotification(true)
    } else if (result.error === 'booking-conflict') {
      setNotificationMessage(t.property.bookingConflict + ' ' + t.property.bookingConflictInfo)
      setShowNotification(true)
    } else {
      setNotificationMessage(t.messages.bookingError)
      setShowNotification(true)
    }

    setIsBooking(false)
  }

  const getMonthLabel = (date: Date) => {
    const monthIndex = date.getMonth()
    const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const
    const monthName = t.calendar.months[monthKeys[monthIndex]]
    return `${monthName} ${date.getFullYear()}`
  }

  const weekDayLabels = language === 'en'
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : language === 'ru'
      ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
      : ['B.e', 'Ç.a', 'Ç', 'C.a', 'C', 'Ş', 'B']

  const calendarCells = buildCalendarCells(displayMonth)
  const oneDayMs = 24 * 60 * 60 * 1000
  const selectedNights = (() => {
    if (!selectedCheckIn || !selectedCheckOut) return 0
    const diff = Math.ceil((new Date(selectedCheckOut).getTime() - new Date(selectedCheckIn).getTime()) / oneDayMs)
    return diff > 0 ? diff : 0
  })()
  const selectedTotal = selectedNights * dailyPrice
  const selectedRangeBusy = (() => {
    if (!selectedCheckIn || !selectedCheckOut || !unavailableFrom || !unavailableTo) return false
    return selectedCheckIn <= unavailableTo && selectedCheckOut >= unavailableFrom
  })()

  const isOccupationExpired = !!unavailableTo && unavailableTo < getTodayISO()
  const isAvailable = isActive !== false || isOccupationExpired
  const availableFromNote = !isAvailable && unavailableTo
    ? (language === 'en' ? `Available again from ${formatDate(unavailableTo)}.` : language === 'ru' ? `Снова будет доступно с ${formatDate(unavailableTo)}.` : `${formatDate(unavailableTo)} tarixindən sonra yenidən boş olacaq.`)
    : ''

  // Самая свежая из действующих. Раньше бралась просто первая запись выборки —
  // а она приходит без сортировки и вполне может оказаться отменённой или
  // отклонённой, то есть подпись «Последнее бронирование» врала дважды.
  const latestBooking = bookings
    .filter(booking => BLOCKING_STATUSES.includes(booking.status))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0]

  return (
    <div className="availability-card">
      {showNotification && <div className="pp-toast">{notificationMessage}</div>}

      <h4>{t.property.availability}</h4>
      <p className={`availability-state ${isAvailable ? 'available' : 'busy'}`}>
        {isAvailable
          ? (language === 'en' ? 'Currently available for booking.' : language === 'ru' ? 'Сейчас доступно для аренды.' : 'Hazırda sifariş üçün açıqdır.')
          : (language === 'en' ? 'Temporarily occupied and hidden from public listing.' : language === 'ru' ? 'Временно занято и скрыто из общего списка.' : 'Müvəqqəti məşğuldur və ümumi siyahıda göstərilmir.')}
      </p>

      <div className="pp-cal-nav">
        <button type="button" onClick={handlePrevMonth} className="pp-cal-nav-btn">←</button>
        <div className="availability-month">{getMonthLabel(displayMonth)}</div>
        <button type="button" onClick={handleNextMonth} className="pp-cal-nav-btn">→</button>
      </div>

      <div className="availability-weekdays">
        {weekDayLabels.map(label => <span key={label}>{label}</span>)}
      </div>
      <div className="availability-calendar-grid">
        {calendarCells.map((cell, index) => {
          const isDisabled = isCellDisabled(cell.dateISO)
          const isBusy = !!cell.dateISO && !!unavailableFrom && !!unavailableTo && cell.dateISO >= unavailableFrom && cell.dateISO <= unavailableTo
          const isBookedBlocked = !isBusy && !!cell.dateISO && cell.inMonth && bookings.some(
            booking => blocksDate(booking, cell.dateISO!)
          )
          const isCheckIn = cell.dateISO === selectedCheckIn
          const isCheckOut = cell.dateISO === selectedCheckOut
          const isInRange = !!selectedCheckIn && !!selectedCheckOut && isDateInSelectedRange(cell.dateISO, selectedCheckIn, selectedCheckOut)
          return (
            <button
              key={`${cell.dateISO || 'empty'}-${index}`}
              onClick={() => !isDisabled && handleCalendarDateClick(cell.dateISO)}
              disabled={isDisabled || !cell.inMonth}
              className={['availability-day', cell.inMonth ? '' : 'outside', isBusy ? 'busy' : '', isBookedBlocked ? 'booked' : '', isCheckIn ? 'check-in' : '', isCheckOut ? 'check-out' : '', isInRange ? 'in-range' : '', !isDisabled && cell.inMonth ? 'selectable' : ''].filter(Boolean).join(' ')}
              type="button"
            >
              {cell.label}
            </button>
          )
        })}
      </div>

      <div className="availability-dates">
        <div>
          <span>{t.property.busyFrom}</span>
          <strong>{formatDate(unavailableFrom)}</strong>
        </div>
        <div>
          <span>{t.property.busyUntil}</span>
          <strong>{formatDate(unavailableTo)}</strong>
        </div>
      </div>

      {selectedCheckIn && (
        <div className="availability-range-inputs">
          <div className="selected-range-display">
            <span>{t.property.checkIn}:</span>
            <strong>{formatDate(selectedCheckIn)}</strong>
          </div>
          {selectedCheckOut && (
            <div className="selected-range-display">
              <span>{t.property.checkOut}:</span>
              <strong>{formatDate(selectedCheckOut)}</strong>
            </div>
          )}
        </div>
      )}

      {selectedNights > 0 && (
        <div className="availability-total-box">
          <p>{language === 'en' ? `${selectedNights} night(s)` : language === 'ru' ? `${selectedNights} ночей` : `${selectedNights} gecə`}</p>
          <strong>{selectedTotal} {currencySymbol(currency)}</strong>
        </div>
      )}

      {selectedCheckIn && selectedCheckOut && selectedNights > 0 && !selectedRangeBusy && (
        <button
          type="button"
          onClick={handleMakeBooking}
          disabled={isBooking}
          aria-busy={isBooking}
          className={`btn pp-book-btn ${isAuthenticated ? 'btn-accent' : 'btn-ghost'}`}
        >
          {isBooking && <InlineSpinner label={t.property.bookingButton} />}
          {isBooking ? t.property.bookingButton : t.property.sendRequest}
        </button>
      )}

      {hasBooked && <div className="pp-booking-success">{t.property.bookingSent}</div>}

      {selectedRangeBusy && (
        <p className="availability-range-warning">
          {language === 'en' ? 'Selected dates overlap with occupied period.' : language === 'ru' ? 'Выбранные даты пересекаются с занятым периодом.' : 'Seçilən tarixlər məşğul günlərlə üst-üstə düşür.'}
        </p>
      )}
      {availableFromNote && <p className="availability-next">{availableFromNote}</p>}

      {latestBooking && (
        <div className="pp-latest-booking">
          <p className="pp-latest-booking-label">
            {language === 'en' ? 'Latest booking:' : language === 'ru' ? 'Последнее бронирование:' : 'Son sifariş:'}
          </p>
          <p className="pp-latest-booking-dates">
            {latestBooking.checkInDate} → {latestBooking.checkOutDate}
          </p>
        </div>
      )}
    </div>
  )
}
