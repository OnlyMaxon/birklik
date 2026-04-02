import React from 'react'
import './SearchBar.css'
import { useLanguage } from '../../context'
import { cities } from '../../data'
import { DateRangePicker } from '../DateRangePicker'

interface SearchBarProps {
  onChange: (value: string) => void
  onSearch?: () => void
  onFiltersOpen?: () => void
  cityValue?: string
  onCitySelect?: (city: string) => void
  checkInValue?: string
  checkOutValue?: string
  guestsValue?: number | null
  onDateChange?: (checkIn: string, checkOut: string) => void
  onGuestsChange?: (guests: number) => void
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
  guestsValue = 1,
  onDateChange,
  onGuestsChange,
  activeFilterCount = 0
}) => {
  const { t, language } = useLanguage()
  const [checkIn, setCheckIn] = React.useState(checkInValue)
  const [checkOut, setCheckOut] = React.useState(checkOutValue)
  const [guests, setGuests] = React.useState(String(guestsValue || 1))
  const [isSuggestOpen, setIsSuggestOpen] = React.useState(false)
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false)
  const [citySearchText, setCitySearchText] = React.useState('')
  const cityInputRef = React.useRef<HTMLInputElement>(null)

  const isEnglish = language === 'en'
  const isRussian = language === 'ru'

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
    setGuests(String(guestsValue || 1))
  }, [selectedCity])

  const normalizedQuery = citySearchText.trim().toLowerCase()
  const filteredCities = cities.filter((city) => {
    if (!normalizedQuery) return true
    return [city.value, city.az, city.en, city.ru].some((label) => label.toLowerCase().includes(normalizedQuery))
  }).slice(0, cityFilterLimit)

  const handleCheckInChange = (nextCheckIn: string, nextCheckOut?: string) => {
    setCheckIn(nextCheckIn)
    const outDate = nextCheckOut !== undefined ? nextCheckOut : checkOut
    setCheckOut(outDate)
    onDateChange?.(nextCheckIn, outDate)
  }

  const handleGuestsChange = (nextGuests: string) => {
    setGuests(nextGuests)
    onGuestsChange?.(Number(nextGuests))
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

  return (
    <form className="search-bar-card" onSubmit={handleSubmit}>
      {/* Location Field */}
      <div className="search-card-field search-location-field">
        <div className="search-field-content">
          <div className="search-field-label">
            {isEnglish ? 'Where are you going?' : isRussian ? 'Куда ты идешь?' : 'Hara gedəcəksən?'}
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
                title={isEnglish ? 'Clear' : isRussian ? 'Очистить' : 'Təmizlə'}
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
          <button
            type="button"
            className="search-date-button"
            onClick={() => setIsDatePickerOpen(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <div className="search-date-button-text">
              <span className="search-date-button-label">
                {isEnglish ? 'When?' : isRussian ? 'Когда?' : 'Nə vaxt?'}
              </span>
              {checkIn && checkOut ? (
                <span className="search-date-button-value">
                  {checkIn} → {checkOut}
                </span>
              ) : checkIn ? (
                <span className="search-date-button-value">
                  {checkIn}
                </span>
              ) : (
                <span className="search-date-button-placeholder">
                  {isEnglish ? 'Select dates' : isRussian ? 'Выберите даты' : 'Tarixləri seçin'}
                </span>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Guests Field */}
      <div className="search-card-field search-guests-field">
        <div className="search-field-content">
          <div className="search-field-label">
            {isEnglish ? 'Guests' : isRussian ? 'Гости' : 'Qonaqlar'}
          </div>
          <select
            className="search-field-input search-guests-select"
            value={guests}
            onChange={(e) => handleGuestsChange(e.target.value)}
          >
            <option value="1">{isEnglish ? '1 guest' : isRussian ? '1 взрослый' : '1 qonaq'}</option>
            <option value="2">{isEnglish ? '2 guests' : isRussian ? '2 взрослых' : '2 qonaq'}</option>
            <option value="3">{isEnglish ? '3 guests' : isRussian ? '3 взрослых' : '3 qonaq'}</option>
            <option value="4">{isEnglish ? '4 guests' : isRussian ? '4 взрослых' : '4 qonaq'}</option>
            <option value="5">{isEnglish ? '5 guests' : isRussian ? '5 взрослых' : '5 qonaq'}</option>
            <option value="6">{isEnglish ? '6 guests' : isRussian ? '6 взрослых' : '6 qonaq'}</option>
            <option value="7">{isEnglish ? '7 guests' : isRussian ? '7 взрослых' : '7 qonaq'}</option>
            <option value="8">{isEnglish ? '8 guests' : isRussian ? '8 взрослых' : '8 qonaq'}</option>
            <option value="9">{isEnglish ? '9 guests' : isRussian ? '9 взрослых' : '9 qonaq'}</option>
            <option value="10">{isEnglish ? '10+ guests' : isRussian ? '10+ взрослых' : '10+ qonaq'}</option>
          </select>
        </div>
      </div>

      {/* Search Button */}
      <div className="search-actions-row">
        <button
          type="button"
          className="search-btn-filters"
          onClick={onFiltersOpen}
          title={isEnglish ? 'Show filters' : isRussian ? 'Показать фильтры' : 'Filtirləri göstər'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          {isEnglish ? 'Filters' : isRussian ? 'Фильтры' : 'Filtrlər'}
          {activeFilterCount > 0 && <span className="search-filter-badge">{activeFilterCount}</span>}
        </button>
        <button type="submit" className="search-btn-main">
          {t.search.button}
        </button>
      </div>

      {isDatePickerOpen && (
        <DateRangePicker
          checkIn={checkIn}
          checkOut={checkOut}
          onDateChange={handleCheckInChange}
          onClose={() => setIsDatePickerOpen(false)}
          language={language as 'en' | 'az' | 'ru'}
        />
      )}
    </form>
  )
}
