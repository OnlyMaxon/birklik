import React from 'react'
import './SearchBar.css'
import { useLanguage } from '../../context'
import { cities } from '../../data'

interface SearchBarProps {
  onChange: (value: string) => void
  onSearch?: () => void
  onFiltersOpen?: () => void
  cityValue?: string
  onCitySelect?: (city: string) => void
  checkInValue?: string
  checkOutValue?: string
  minGuestsValue?: number | null
  maxGuestsValue?: number | string | null
  onDateChange?: (checkIn: string, checkOut: string) => void
  onMinGuestsChange?: (guests: number) => void
  onMaxGuestsChange?: (guests: number | string) => void
  activeFilterCount?: number
}


const cityFilterLimit = 6

export const SearchBar: React.FC<SearchBarProps> = ({
  onChange,
  onSearch,
  onFiltersOpen,
  cityValue = '',
  onCitySelect,
  checkInValue = '',
  checkOutValue = '',
  minGuestsValue = null,
  maxGuestsValue = null,
  onDateChange,
  onMinGuestsChange,
  onMaxGuestsChange,
  activeFilterCount = 0
}) => {
  const { t, language } = useLanguage()
  const [checkIn, setCheckIn] = React.useState(checkInValue)
  const [checkOut, setCheckOut] = React.useState(checkOutValue)
  const [minGuests, setMinGuests] = React.useState(minGuestsValue?.toString() || '1')
  const [maxGuests, setMaxGuests] = React.useState(
    maxGuestsValue === '10+' ? '10+' : (maxGuestsValue?.toString() || '10')
  )
  const [isSuggestOpen, setIsSuggestOpen] = React.useState(false)
  const [citySearchText, setCitySearchText] = React.useState('')
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false)
  const [tempCheckIn, setTempCheckIn] = React.useState(checkInValue)
  const [tempCheckOut, setTempCheckOut] = React.useState(checkOutValue)
  const cityInputRef = React.useRef<HTMLInputElement>(null)
  const datePickerRef = React.useRef<HTMLDivElement>(null)

  const isEnglish = language === 'en'
  const isRussian = language === 'ru'

  // Get current month and next month for two-calendar view
  const now = new Date()
  const calendarMonth = now.getMonth()
  const calendarYear = now.getFullYear()
  const secondMonth = calendarMonth === 11 ? 0 : calendarMonth + 1
  const secondYear = calendarMonth === 11 ? calendarYear + 1 : calendarYear

  // Find and display selected city
  const selectedCity = cityValue
    ? cities.find((c) => c.value === cityValue)
    : null

  const getCityLabel = (city: typeof cities[number]) => {
    if (isEnglish) return city.en
    if (isRussian) return city.ru
    return city.az
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch?.()
  }

  React.useEffect(() => {
    setCheckIn(checkInValue)
  }, [checkInValue])

  React.useEffect(() => {
    setCheckOut(checkOutValue)
  }, [checkOutValue])

  React.useEffect(() => {
    setMinGuests(minGuestsValue?.toString() || '1')
  }, [minGuestsValue])

  React.useEffect(() => {
    setMaxGuests(maxGuestsValue === '10+' ? '10+' : (maxGuestsValue?.toString() || '10'))
  }, [maxGuestsValue])

  const normalizedQuery = citySearchText.trim().toLowerCase()
  const filteredCities = cities.filter((city) => {
    if (!normalizedQuery) return true
    return [city.value, city.az, city.en, city.ru].some((label) => label.toLowerCase().includes(normalizedQuery))
  }).slice(0, cityFilterLimit)

  const handleMinGuestsChange = (value: string) => {
    const newMin = Number(value)
    setMinGuests(value)
    onMinGuestsChange?.(newMin)
    
    // If min is greater than max, update max to be equal to min
    const currentMax = maxGuests === '10+' ? 999 : Number(maxGuests)
    if (newMin > currentMax) {
      setMaxGuests(value)
      onMaxGuestsChange?.(newMin)
    }
  }

  const handleMaxGuestsChange = (value: string) => {
    const newMax = value === '10+' ? 999 : Number(value)
    const currentMin = Number(minGuests)
    
    setMaxGuests(value)
    onMaxGuestsChange?.(value === '10+' ? '10+' : newMax)
    
    // If max is less than min, update min to be equal to max
    if (newMax < currentMin) {
      setMinGuests(value === '10+' ? '10' : value)
      onMinGuestsChange?.(newMax)
    }
  }

  const handlePickCity = (city: typeof cities[number]) => {
    onCitySelect?.(city.value)
    setIsSuggestOpen(false)
  }

  const handleCityInputChange = (inputValue: string) => {
    setCitySearchText(inputValue)
    onChange(inputValue)
    // Очищаем выбранный город только если пользователь начал печатать новый текст
    if (inputValue.trim() !== '') {
      onCitySelect?.('')
    }
  }

  const handleClearCity = () => {
    setCitySearchText('')
    onCitySelect?.('')
    setIsSuggestOpen(false)
  }

  // Get today's date in YYYY-MM-DD format
  const getTodayISO = (): string => new Date().toISOString().split('T')[0]

  // Format date to YYYY-MM-DD
  const dateToISO = (date: Date): string => date.toISOString().split('T')[0]

  // Compare dates (ignoring time)
  const isSameDay = (date1: string, date2: string): boolean => date1 === date2

  const isBeforeDay = (date1: string, date2: string): boolean => date1 < date2
  const isAfterDay = (date1: string, date2: string): boolean => date1 > date2
  const isBetween = (date: string, start: string, end: string): boolean => date > start && date < end

  // Get day name for calendar header
  const getDayName = (dayIndex: number): string => {
    const dayKeys: Array<keyof typeof t.calendar.days> = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    return t.calendar.days[dayKeys[dayIndex]]
  }

  // Get month name
  const getMonthName = (month: number): string => {
    const monthKeys: Array<keyof typeof t.calendar.months> = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    return t.calendar.months[monthKeys[month]]
  }

  // Generate calendar days for a given month
  const generateCalendarDays = (month: number, year: number): (number | null)[] => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    
    const days: (number | null)[] = []
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }
    return days
  }

  // Handle date selection with range logic
  const handleDateSelect = (day: number, month: number, year: number) => {
    const selectedDate = dateToISO(new Date(year, month, day))
    const today = getTodayISO()

    if (isBeforeDay(selectedDate, today)) return // Prevent past dates

    if (!tempCheckIn || isAfterDay(selectedDate, tempCheckIn)) {
      // If no check-in yet, or selected date is after check-in, set as check-out
      if (tempCheckIn && isBeforeDay(selectedDate, tempCheckIn)) {
        setTempCheckIn(selectedDate)
      } else if (!tempCheckIn) {
        setTempCheckIn(selectedDate)
      } else {
        setTempCheckOut(selectedDate)
      }
    } else {
      // Selected date is before or equal to check-in
      setTempCheckIn(selectedDate)
      setTempCheckOut('')
    }
  }

  // Confirm date selection
  const handleDatePickerConfirm = () => {
    if (tempCheckIn && tempCheckOut) {
      setCheckIn(tempCheckIn)
      setCheckOut(tempCheckOut)
      onDateChange?.(tempCheckIn, tempCheckOut)
      setIsDatePickerOpen(false)
    }
  }

  // Cancel date selection
  const handleDatePickerCancel = () => {
    setTempCheckIn(checkIn)
    setTempCheckOut(checkOut)
    setIsDatePickerOpen(false)
  }

  return (
    <form className="search-bar-card" onSubmit={handleSubmit}>
      {/* Location Field */}
      <div className="search-card-field search-location-field">
        <div className="search-field-content">
          <div className="search-field-label">
            {t.search.whereGoing}
          </div>
          <div className="search-location-wrapper">
            <input
              ref={cityInputRef}
              type="text"
              className="search-field-input"
              placeholder={t.search.placeholder}
              value={selectedCity ? getCityLabel(selectedCity) : citySearchText}
              onChange={(e) => handleCityInputChange(e.target.value)}
              onFocus={() => setIsSuggestOpen(true)}
              onBlur={() => window.setTimeout(() => setIsSuggestOpen(false), 120)}
            />
            {selectedCity && (
              <button
                type="button"
                className="search-city-clear"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleClearCity()
                }}
                title={t.search.clear}
              >
                ✕
              </button>
            )}
            {isSuggestOpen && filteredCities.length > 0 && (
              <div className="search-suggestions" role="listbox">
                {filteredCities.map((city) => (
                  <button
                    key={city.value}
                    type="button"
                    className={`search-suggestion-item ${cityValue === city.value ? 'active' : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      cityInputRef.current?.blur()
                      handlePickCity(city)
                    }}
                  >
                    {getCityLabel(city)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dates Field */}
      <div className="search-card-field search-dates-field">
        <div className="search-field-content">
          <div className="search-field-label">
            {t.search.when}
          </div>
          <button
            type="button"
            className="search-date-picker-button"
            onClick={() => {
              setTempCheckIn(checkIn)
              setTempCheckOut(checkOut)
              setIsDatePickerOpen(true)
            }}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #b7925d',
              borderRadius: '8px',
              backgroundColor: '#fff5eb',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: '600',
              color: checkIn && checkOut ? '#b7925d' : '#999',
              transition: 'all 0.3s ease'
            }}
          >
            {checkIn && checkOut 
              ? `${checkIn.split('-').reverse().join('.')} → ${checkOut.split('-').reverse().join('.')}`
              : (t.search.selectDates)
            }
          </button>

          {/* Date Picker Modal - AirBNB Style */}
          {isDatePickerOpen && (
            <div 
              className="search-date-picker-modal"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  handleDatePickerCancel()
                }
              }}
            >
              <div
                ref={datePickerRef}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  maxHeight: '85vh',
                  overflowY: 'auto',
                  boxShadow: '0 10px 50px rgba(0, 0, 0, 0.3)',
                  width: '95%',
                  maxWidth: '1100px'
                }}
              >
                {/* Header with title and close button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '600', color: '#2d2420' }}>
                    {t.search.selectDates}
                  </h2>
                  <button
                    type="button"
                    onClick={handleDatePickerCancel}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '1.5rem',
                      cursor: 'pointer',
                      color: '#999'
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Calendar container */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '1.5rem' }}>
                  {/* First Calendar */}
                  <div>
                    {/* Month/Year header with navigation */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>
                        {getMonthName(calendarMonth)} {calendarYear}
                      </h3>
                    </div>

                    {/* Day names header */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => (
                        <div
                          key={dayIndex}
                          style={{
                            textAlign: 'center',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: '#999',
                            padding: '0.5rem 0'
                          }}
                        >
                          {getDayName(dayIndex)}
                        </div>
                      ))}
                    </div>

                    {/* Calendar days */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
                      {generateCalendarDays(calendarMonth, calendarYear).map((day, index) => {
                        if (day === null) {
                          return <div key={`empty-${index}`} />
                        }
                        const dateStr = dateToISO(new Date(calendarYear, calendarMonth, day))
                        const today = getTodayISO()
                        const isPast = isBeforeDay(dateStr, today)
                        const isCheckIn = isSameDay(dateStr, tempCheckIn)
                        const isCheckOut = isSameDay(dateStr, tempCheckOut)
                        const isInRange = tempCheckIn && tempCheckOut && isBetween(dateStr, tempCheckIn, tempCheckOut)

                        return (
                          <button
                            key={`day-${day}`}
                            type="button"
                            onClick={() => !isPast && handleDateSelect(day, calendarMonth, calendarYear)}
                            disabled={isPast}
                            style={{
                              padding: '0.75rem',
                              border: isCheckIn || isCheckOut ? '2px solid #b7925d' : isInRange ? 'none' : '1px solid #e0e0e0',
                              borderRadius: isCheckIn || isCheckOut ? '8px' : '4px',
                              backgroundColor: isCheckIn || isCheckOut ? '#b7925d' : isInRange ? '#f0e6d2' : isPast ? '#f9f9f9' : 'white',
                              color: isCheckIn || isCheckOut ? 'white' : isPast ? '#ccc' : '#2d2420',
                              cursor: isPast ? 'not-allowed' : 'pointer',
                              fontWeight: isCheckIn || isCheckOut ? '700' : '500',
                              fontSize: '0.9rem',
                              opacity: isPast ? 0.5 : 1
                            }}
                          >
                            {day}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Second Calendar (Next Month) */}
                  <div>
                    {/* Month/Year header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>
                        {getMonthName(secondMonth)} {secondYear}
                      </h3>
                    </div>

                    {/* Day names header */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => (
                        <div
                          key={dayIndex}
                          style={{
                            textAlign: 'center',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: '#999',
                            padding: '0.5rem 0'
                          }}
                        >
                          {getDayName(dayIndex)}
                        </div>
                      ))}
                    </div>

                    {/* Calendar days */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
                      {generateCalendarDays(secondMonth, secondYear).map((day, index) => {
                        if (day === null) {
                          return <div key={`empty-${index}`} />
                        }
                        const dateStr = dateToISO(new Date(secondYear, secondMonth, day))
                        const today = getTodayISO()
                        const isPast = isBeforeDay(dateStr, today)
                        const isCheckIn = isSameDay(dateStr, tempCheckIn)
                        const isCheckOut = isSameDay(dateStr, tempCheckOut)
                        const isInRange = tempCheckIn && tempCheckOut && isBetween(dateStr, tempCheckIn, tempCheckOut)

                        return (
                          <button
                            key={`day-${day}`}
                            type="button"
                            onClick={() => !isPast && handleDateSelect(day, secondMonth, secondYear)}
                            disabled={isPast}
                            style={{
                              padding: '0.75rem',
                              border: isCheckIn || isCheckOut ? '2px solid #b7925d' : isInRange ? 'none' : '1px solid #e0e0e0',
                              borderRadius: isCheckIn || isCheckOut ? '8px' : '4px',
                              backgroundColor: isCheckIn || isCheckOut ? '#b7925d' : isInRange ? '#f0e6d2' : isPast ? '#f9f9f9' : 'white',
                              color: isCheckIn || isCheckOut ? 'white' : isPast ? '#ccc' : '#2d2420',
                              cursor: isPast ? 'not-allowed' : 'pointer',
                              fontWeight: isCheckIn || isCheckOut ? '700' : '500',
                              fontSize: '0.9rem',
                              opacity: isPast ? 0.5 : 1
                            }}
                          >
                            {day}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Selected dates summary */}
                {tempCheckIn && (
                  <div style={{ padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '8px', marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>
                      {t.search.selectedDates}
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: '600', color: '#2d2420' }}>
                      {tempCheckIn.split('-').reverse().join('.')} 
                      {tempCheckOut && ` → ${tempCheckOut.split('-').reverse().join('.')}`}
                      {!tempCheckOut && (
                        <span style={{ color: '#999', fontSize: '0.9rem' }}>
                          {t.search.selectCheckout}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    type="button"
                    onClick={handleDatePickerCancel}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      backgroundColor: '#fff',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '0.95rem',
                      color: '#2d2420'
                    }}
                  >
                    {t.search.cancelBtn}
                  </button>
                  <button
                    type="button"
                    onClick={handleDatePickerConfirm}
                    disabled={!tempCheckIn || !tempCheckOut}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      border: 'none',
                      borderRadius: '8px',
                      backgroundColor: (!tempCheckIn || !tempCheckOut) ? '#ccc' : '#b7925d',
                      color: 'white',
                      cursor: (!tempCheckIn || !tempCheckOut) ? 'not-allowed' : 'pointer',
                      fontWeight: '600',
                      fontSize: '0.95rem'
                    }}
                  >
                    {t.search.confirmBtn}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Guests Field */}
      <div className="search-card-field search-guests-field">
        <div className="search-field-content">
          <div className="search-field-label">
            {t.search.guests}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.25rem' }}>
                {t.search.min}
              </div>
              <select
                className="search-field-input search-guests-select"
                value={minGuests}
                onChange={(e) => handleMinGuestsChange(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
                <option value="7">7</option>
                <option value="8">8</option>
                <option value="9">9</option>
                <option value="10">10</option>
              </select>
            </div>
            <span style={{ color: '#999', marginTop: '1rem' }}>-</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.25rem' }}>
                {t.search.max}
              </div>
              <select
                className="search-field-input search-guests-select"
                value={maxGuests}
                onChange={(e) => handleMaxGuestsChange(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
                <option value="7">7</option>
                <option value="8">8</option>
                <option value="9">9</option>
                <option value="10">10</option>
                <option value="10+">10+</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Search Button */}
      <div className="search-actions-row">
        <button
          type="button"
          className="search-btn-filters"
          onClick={onFiltersOpen}
          title={t.search.showFilters}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          {t.search.filterLabel}
          {activeFilterCount > 0 && <span className="search-filter-badge">{activeFilterCount}</span>}
        </button>
        <button type="submit" className="search-btn-main">
          {t.search.button}
        </button>
      </div>
    </form>
  )
}
