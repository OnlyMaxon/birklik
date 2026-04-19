import React from 'react'
import './DateRangePicker.css'
import { useLanguage } from '../../context'

interface DateRangePickerProps {
  checkIn: string
  checkOut: string
  onDateChange: (checkIn: string, checkOut: string) => void
  onClose?: () => void
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  checkIn,
  checkOut,
  onDateChange,
  onClose
}) => {
  const { t } = useLanguage()
  const [currentMonth, setCurrentMonth] = React.useState(new Date())
  const [tempCheckIn, setTempCheckIn] = React.useState(checkIn)
  const [tempCheckOut, setTempCheckOut] = React.useState(checkOut)

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const formatDate = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null
    const date = new Date(dateStr + 'T00:00:00')
    return isNaN(date.getTime()) ? null : date
  }

  const handleDayClick = (day: number) => {
    const selectedDate = formatDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))
    const checkInDate = parseDate(tempCheckIn)
    const checkOutDate = parseDate(tempCheckOut)

    if (!tempCheckIn || (checkInDate && checkOutDate && new Date(selectedDate) < checkInDate)) {
      setTempCheckIn(selectedDate)
      setTempCheckOut('')
    } else if (tempCheckIn && !tempCheckOut) {
      if (new Date(selectedDate) > new Date(tempCheckIn)) {
        setTempCheckOut(selectedDate)
        onDateChange(tempCheckIn, selectedDate)
        setTimeout(() => onClose?.(), 300)
      } else {
        setTempCheckIn(selectedDate)
        setTempCheckOut('')
      }
    } else if (tempCheckIn && tempCheckOut) {
      setTempCheckIn(selectedDate)
      setTempCheckOut('')
    }
  }

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const getDayStatus = (day: number): string => {
    const dayDate = formatDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))
    const checkInDate = parseDate(tempCheckIn)
    const checkOutDate = parseDate(tempCheckOut)
    const currentDate = new Date(dayDate)

    if (dayDate === tempCheckIn) return 'check-in'
    if (dayDate === tempCheckOut) return 'check-out'

    if (checkInDate && checkOutDate) {
      if (currentDate > checkInDate && currentDate < checkOutDate) {
        return 'in-range'
      }
    }

    return ''
  }

  const monthKeys: Array<keyof typeof t.calendar.months> = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const dayKeys: Array<keyof typeof t.calendar.days> = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  
  const months = monthKeys.map(key => t.calendar.months[key])
  const days = dayKeys.map(key => t.calendar.days[key])
  const daysInMonth = getDaysInMonth(currentMonth)
  const firstDay = getFirstDayOfMonth(currentMonth)
  const calendarDays = []

  // Empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null)
  }

  // Days of month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day)
  }

  const nightsCount = (() => {
    const checkInDate = parseDate(tempCheckIn)
    const checkOutDate = parseDate(tempCheckOut)
    if (checkInDate && checkOutDate) {
      const diff = checkOutDate.getTime() - checkInDate.getTime()
      return Math.ceil(diff / (1000 * 60 * 60 * 24))
    }
    return 0
  })()

  const labels = {
    title: t.booking.selectDates,
    checkIn: t.booking.checkIn,
    checkOut: t.booking.checkOut,
    nights: t.booking.nights,
    confirmed: t.booking.confirmed
  }

  const label = labels

  return (
    <div className="date-range-picker-overlay">
      <div className="date-range-picker">
        <div className="date-range-header">
          <h3>{label.title}</h3>
          <button
            className="date-range-close"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="date-range-content">
          <div className="date-range-status">
            {tempCheckIn && (
              <div className="date-range-info">
                <div className="date-range-item">
                  <span className="date-range-label">{label.checkIn}</span>
                  <span className="date-range-value">{tempCheckIn}</span>
                </div>
                {tempCheckOut && (
                  <>
                    <span className="date-range-arrow">→</span>
                    <div className="date-range-item">
                      <span className="date-range-label">{label.checkOut}</span>
                      <span className="date-range-value">{tempCheckOut}</span>
                    </div>
                    <div className="date-range-nights">
                      {nightsCount} {label.nights}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="calendar-container">
            <div className="calendar">
              <div className="calendar-header">
                <button onClick={handlePrevMonth} className="calendar-nav-btn" type="button">
                  ←
                </button>
                <h4 className="calendar-month-year">
                  {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </h4>
                <button onClick={handleNextMonth} className="calendar-nav-btn" type="button">
                  →
                </button>
              </div>

              <div className="calendar-weekdays">
                {days.map((day) => (
                  <div key={day} className="calendar-weekday">
                    {day}
                  </div>
                ))}
              </div>

              <div className="calendar-days">
                {calendarDays.map((day, index) => {
                  const status = day ? getDayStatus(day) : ''
                  const isDisabled = !!(day && new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day) < new Date())
                  return (
                    <button
                      key={index}
                      onClick={() => day && !isDisabled && handleDayClick(day)}
                      className={`calendar-day ${status} ${isDisabled ? 'disabled' : ''} ${!day ? 'empty' : ''}`}
                      type="button"
                      disabled={isDisabled}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {tempCheckIn && tempCheckOut && (
            <div className="date-range-actions">
              <button
                className="date-range-confirm"
                onClick={onClose}
                type="button"
              >
                ✓ {label.confirmed}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
