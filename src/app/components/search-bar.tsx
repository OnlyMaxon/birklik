import React from 'react'
import ReactDOM from 'react-dom'
import { useLanguage } from '@/components/providers'
import {cities, placeMatchScore} from '@birklik/core/data'
import {FieldPopover, moveFocusWithArrows} from './field-popover'

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
const guestOptions = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
const maxGuestOptions = [...guestOptions, '10+']

/**
 * Выбор числа гостей.
 *
 * Здесь был системный `<select>`. Выглядел он на каждой платформе по-своему и с
 * остальной строкой поиска не сходился: на телефоне это колесо во весь экран, в
 * Windows — серый список другим шрифтом. Оформить его нельзя, оформляется только
 * рамка вокруг.
 *
 * ⚠️ Список раскрывается через FieldPopover, а не рядом: строка поиска стоит
 * внутри `.hero` с `overflow: hidden`, и раскрытый вниз список обрезало бы
 * обложкой — тем же, чем обрезало подсказки городов.
 */
interface GuestSelectProps {
  label: string
  ariaLabel: string
  value: string
  options: string[]
  onSelect: (value: string) => void
}

const GuestSelect: React.FC<GuestSelectProps> = ({label, ariaLabel, value, options, onSelect}) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const listId = React.useId()

  const close = React.useCallback(() => setIsOpen(false), [])

  const pick = (option: string) => {
    onSelect(option)
    setIsOpen(false)
    // Фокус возвращается на кнопку: иначе он остался бы на исчезнувшем пункте и
    // следующий Tab начал бы обход страницы заново.
    triggerRef.current?.focus()
  }

  return (
    <div className="guests-col">
      <span className="guests-sublabel">{label}</span>
      <button
        ref={triggerRef}
        type="button"
        className="search-guests-select search-guests-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        onClick={() => setIsOpen(open => !open)}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setIsOpen(true)
          }
        }}
      >
        <span className="search-guests-value">{value}</span>
      </button>

      <FieldPopover
        id={listId}
        anchorRef={triggerRef}
        open={isOpen}
        onDismiss={close}
        onKeyDown={moveFocusWithArrows}
        minWidth={96}
        className="field-popover--guests"
      >
        {options.map(option => (
          <button
            key={option}
            type="button"
            role="option"
            data-popover-option=""
            aria-selected={option === value}
            className={`field-popover-option ${option === value ? 'active' : ''}`}
            onClick={() => pick(option)}
          >
            {option}
          </button>
        ))}
      </FieldPopover>
    </div>
  )
}

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
  const cityFieldRef = React.useRef<HTMLDivElement>(null)
  const citySuggestionsId = React.useId()

  const isEnglish = language === 'en'
  const isRussian = language === 'ru'

  const now = new Date()
  const calendarMonth = now.getMonth()
  const calendarYear = now.getFullYear()
  const secondMonth = calendarMonth === 11 ? 0 : calendarMonth + 1
  const secondYear = calendarMonth === 11 ? calendarYear + 1 : calendarYear

  const selectedCity = cityValue ? cities.find((c) => c.value === cityValue) : null

  const getCityLabel = (city: typeof cities[number]) => {
    if (isEnglish) return city.en
    if (isRussian) return city.ru
    return city.az
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch?.()
  }

  React.useEffect(() => { setCheckIn(checkInValue) }, [checkInValue])
  React.useEffect(() => { setCheckOut(checkOutValue) }, [checkOutValue])
  React.useEffect(() => { setMinGuests(minGuestsValue?.toString() || '1') }, [minGuestsValue])
  React.useEffect(() => {
    setMaxGuests(maxGuestsValue === '10+' ? '10+' : (maxGuestsValue?.toString() || '10'))
  }, [maxGuestsValue])

  // ⚠️ Подсказки сравниваются СВЁРНУТЫМ написанием, а не подстрокой: иначе
  // «Gebele» не находил «Qəbələ», «Guba» — «Quba», «Сумгаит» — «Sumqayıt».
  // Разбор правил — в core/src/data/place-match.ts.
  //
  // Здесь, в отличие от отбора объявлений, опечатка ПРОЩАЕТСЯ: человек видит
  // предложенный список и выбирает сам, поэтому «Ахдам» вправе привести к
  // Ağdam. В отборе такой вольности нет — там виден только результат.
  const cityQuery = citySearchText.trim()
  const filteredCities = React.useMemo(() => {
    if (!cityQuery) return cities.slice(0, cityFilterLimit)

    return cities
      .map((city) => ({
        city,
        score: Math.max(
          ...[city.value, city.az, city.en, city.ru].map((name) => placeMatchScore(name, cityQuery, true))
        )
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.city.value.localeCompare(b.city.value))
      .slice(0, cityFilterLimit)
      .map((entry) => entry.city)
  }, [cityQuery])

  const handleMinGuestsChange = (value: string) => {
    const newMin = Number(value)
    setMinGuests(value)
    onMinGuestsChange?.(newMin)
    const currentMax = maxGuests === '10+' ? 999 : Number(maxGuests)
    if (newMin > currentMax) { setMaxGuests(value); onMaxGuestsChange?.(newMin) }
  }

  const handleMaxGuestsChange = (value: string) => {
    const newMax = value === '10+' ? 999 : Number(value)
    const currentMin = Number(minGuests)
    setMaxGuests(value)
    onMaxGuestsChange?.(value === '10+' ? '10+' : newMax)
    if (newMax < currentMin) { setMinGuests(value === '10+' ? '10' : value); onMinGuestsChange?.(newMax) }
  }

  const closeSuggest = React.useCallback(() => setIsSuggestOpen(false), [])

  const handlePickCity = (city: typeof cities[number]) => {
    onCitySelect?.(city.value)
    setIsSuggestOpen(false)
  }

  const handleCityInputChange = (inputValue: string) => {
    setCitySearchText(inputValue)
    onChange(inputValue)
    if (inputValue.trim() !== '') onCitySelect?.('')
  }

  const handleClearCity = () => {
    setCitySearchText('')
    onCitySelect?.('')
    setIsSuggestOpen(false)
  }

  const getTodayISO = (): string => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const dateToISO = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }
  const isSameDay = (d1: string, d2: string) => d1 === d2
  const isBeforeDay = (d1: string, d2: string) => d1 < d2
  const isBetween = (date: string, start: string, end: string) => date > start && date < end

  const getDayName = (i: number) => {
    const keys: Array<keyof typeof t.calendar.days> = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    return t.calendar.days[keys[i]]
  }

  const getMonthName = (m: number) => {
    const keys: Array<keyof typeof t.calendar.months> = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    return t.calendar.months[keys[m]]
  }

  const generateCalendarDays = (month: number, year: number): (number | null)[] => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: (number | null)[] = []
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null)
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(i)
    return days
  }

  const handleDateSelect = (day: number, month: number, year: number) => {
    const selectedDate = dateToISO(new Date(year, month, day))
    if (isBeforeDay(selectedDate, getTodayISO())) return
    if (!tempCheckIn || isBeforeDay(selectedDate, tempCheckIn)) {
      setTempCheckIn(selectedDate)
      setTempCheckOut('')
    } else {
      setTempCheckOut(selectedDate)
    }
  }

  const handleDatePickerConfirm = () => {
    if (tempCheckIn && tempCheckOut) {
      setCheckIn(tempCheckIn)
      setCheckOut(tempCheckOut)
      onDateChange?.(tempCheckIn, tempCheckOut)
      setIsDatePickerOpen(false)
    }
  }

  const handleDatePickerCancel = () => {
    setTempCheckIn(checkIn)
    setTempCheckOut(checkOut)
    setIsDatePickerOpen(false)
  }

  const renderCalendar = (month: number, year: number) => (
    <div className="date-picker-calendar">
      <div className="calendar-month-header">
        <h3>{getMonthName(month)} {year}</h3>
      </div>
      <div className="calendar-day-names">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="calendar-day-name">{getDayName(i)}</div>
        ))}
      </div>
      <div className="calendar-days-grid">
        {generateCalendarDays(month, year).map((day, idx) => {
          if (day === null) return <div key={`e-${idx}`} className="calendar-day-empty" />
          const dateStr = dateToISO(new Date(year, month, day))
          const today = getTodayISO()
          const isPast = isBeforeDay(dateStr, today)
          const isCI = isSameDay(dateStr, tempCheckIn)
          const isCO = isSameDay(dateStr, tempCheckOut)
          const isRange = !!(tempCheckIn && tempCheckOut && isBetween(dateStr, tempCheckIn, tempCheckOut))
          const cls = [
            'calendar-day',
            isPast ? 'past' : '',
            isCI ? 'check-in' : '',
            isCO ? 'check-out' : '',
            isRange ? 'in-range' : '',
          ].filter(Boolean).join(' ')
          return (
            <button
              key={`d-${day}`}
              type="button"
              className={cls}
              onClick={() => !isPast && handleDateSelect(day, month, year)}
              disabled={isPast}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )

  const formatDate = (d: string) => d.split('-').reverse().join('.')

  return (
    <form className="search-bar-card" onSubmit={handleSubmit}>

      {/* Location */}
      <div className="search-card-field search-location-field">
        <div className="search-field-content">
          <div className="search-field-label">{t.search.whereGoing}</div>
          <div className="search-location-wrapper" ref={cityFieldRef}>
            <input
              ref={cityInputRef}
              type="text"
              className="search-field-input"
              placeholder={t.search.placeholder}
              role="combobox"
              aria-expanded={isSuggestOpen && filteredCities.length > 0}
              aria-controls={isSuggestOpen ? citySuggestionsId : undefined}
              aria-autocomplete="list"
              value={selectedCity ? getCityLabel(selectedCity) : citySearchText}
              onChange={(e) => handleCityInputChange(e.target.value)}
              onFocus={() => setIsSuggestOpen(true)}
              onBlur={() => window.setTimeout(() => setIsSuggestOpen(false), 120)}
            />
            {selectedCity && (
              <button
                type="button"
                className="search-city-clear"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleClearCity() }}
                title={t.search.clear}
              >✕</button>
            )}
            {/* ⚠️ Панель уходит в портал: раскрытая вниз, она свисает ниже
                обложки, а у `.hero` стоит `overflow: hidden` — список обрезало
                ровно по краю, и это выглядело как «подсказки под сеткой
                объявлений». Подробности — в field-popover.tsx. */}
            <FieldPopover
              id={citySuggestionsId}
              anchorRef={cityFieldRef}
              open={isSuggestOpen && filteredCities.length > 0}
              onDismiss={closeSuggest}
              onKeyDown={moveFocusWithArrows}
              className="field-popover--cities"
            >
              {filteredCities.map((city) => (
                <button
                  key={city.value}
                  type="button"
                  role="option"
                  data-popover-option=""
                  aria-selected={cityValue === city.value}
                  className={`field-popover-option ${cityValue === city.value ? 'active' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); cityInputRef.current?.blur(); handlePickCity(city) }}
                >
                  {getCityLabel(city)}
                </button>
              ))}
            </FieldPopover>
          </div>
        </div>
      </div>

      {/* Dates */}
      <div className="search-card-field search-dates-field">
        <div className="search-field-content">
          <div className="search-field-label">{t.search.when}</div>
          <button
            type="button"
            className="date-picker-trigger"
            onClick={() => { setTempCheckIn(checkIn); setTempCheckOut(checkOut); setIsDatePickerOpen(true) }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {checkIn && checkOut
              ? <span className="date-picker-trigger-text">{formatDate(checkIn)} → {formatDate(checkOut)}</span>
              : <span className="date-picker-trigger-placeholder">{t.search.selectDates}</span>
            }
          </button>

          {isDatePickerOpen && ReactDOM.createPortal(
            <div
              className="date-picker-overlay"
              onClick={(e) => { if (e.target === e.currentTarget) handleDatePickerCancel() }}
            >
              <div className="date-picker-modal">
                <div className="date-picker-header">
                  <h2>{t.search.selectDates}</h2>
                  <button type="button" className="date-picker-close" onClick={handleDatePickerCancel}>✕</button>
                </div>

                <div className="date-picker-calendars">
                  {renderCalendar(calendarMonth, calendarYear)}
                  {renderCalendar(secondMonth, secondYear)}
                </div>

                {tempCheckIn && (
                  <div className="date-picker-summary">
                    <div className="date-picker-summary-label">{t.search.selectedDates}</div>
                    <div className="date-picker-summary-value">
                      {formatDate(tempCheckIn)}
                      {tempCheckOut
                        ? ` → ${formatDate(tempCheckOut)}`
                        : <span className="date-picker-summary-hint"> — {t.search.selectCheckout}</span>
                      }
                    </div>
                  </div>
                )}

                <div className="date-picker-actions">
                  <button type="button" className="date-picker-cancel" onClick={handleDatePickerCancel}>
                    {t.search.cancelBtn}
                  </button>
                  <button
                    type="button"
                    className="date-picker-confirm"
                    onClick={handleDatePickerConfirm}
                    disabled={!tempCheckIn || !tempCheckOut}
                  >
                    {t.search.confirmBtn}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>
      </div>

      {/* Guests */}
      <div className="search-card-field search-guests-field">
        <div className="search-field-content">
          <div className="search-field-label">{t.search.guests}</div>
          <div className="guests-wrapper">
            <GuestSelect
              label={t.search.min}
              ariaLabel={`${t.search.guests} — ${t.search.min}`}
              value={minGuests}
              options={guestOptions}
              onSelect={handleMinGuestsChange}
            />
            <span className="guests-separator">–</span>
            <GuestSelect
              label={t.search.max}
              ariaLabel={`${t.search.guests} — ${t.search.max}`}
              value={maxGuests}
              options={maxGuestOptions}
              onSelect={handleMaxGuestsChange}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="search-actions-row">
        <button type="button" className="search-btn-filters" onClick={onFiltersOpen} title={t.search.showFilters}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
