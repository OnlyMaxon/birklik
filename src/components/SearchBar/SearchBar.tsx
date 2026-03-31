import React from 'react'
import './SearchBar.css'
import { useLanguage } from '../../context'

interface SearchBarProps {
  value: string
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
}

const CITY_SUGGESTIONS = [
  { value: 'Baku', az: 'Bakı', en: 'Baku', ru: 'Баку' },
  { value: 'Sumqayit', az: 'Sumqayıt', en: 'Sumqayit', ru: 'Сумгайыт' },
  { value: 'Gabala', az: 'Qəbələ', en: 'Gabala', ru: 'Габала' },
  { value: 'Quba', az: 'Quba', en: 'Quba', ru: 'Губа' }
]

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onSearch,
  onFiltersOpen,
  cityValue = '',
  onCitySelect,
  checkInValue = '',
  checkOutValue = '',
  guestsValue = 1,
  onDateChange,
  onGuestsChange
}) => {
  const { t, language } = useLanguage()
  const [checkIn, setCheckIn] = React.useState(checkInValue)
  const [checkOut, setCheckOut] = React.useState(checkOutValue)
  const [guests, setGuests] = React.useState(String(guestsValue || 1))
  const [isSuggestOpen, setIsSuggestOpen] = React.useState(false)

  const isEnglish = language === 'en'
  const isRussian = language === 'ru'

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
  }, [guestsValue])

  const getCityLabel = (city: typeof CITY_SUGGESTIONS[number]) => {
    if (isEnglish) return city.en
    if (isRussian) return city.ru
    return city.az
  }

  const normalizedQuery = value.trim().toLowerCase()
  const filteredCities = CITY_SUGGESTIONS.filter((city) => {
    if (!normalizedQuery) return true
    return [city.value, city.az, city.en, city.ru].some((label) => label.toLowerCase().includes(normalizedQuery))
  }).slice(0, 6)

  const handleCheckInChange = (nextCheckIn: string) => {
    setCheckIn(nextCheckIn)
    onDateChange?.(nextCheckIn, checkOut)
  }

  const handleCheckOutChange = (nextCheckOut: string) => {
    setCheckOut(nextCheckOut)
    onDateChange?.(checkIn, nextCheckOut)
  }

  const handleGuestsChange = (nextGuests: string) => {
    setGuests(nextGuests)
    onGuestsChange?.(Number(nextGuests))
  }

  const handlePickCity = (city: typeof CITY_SUGGESTIONS[number]) => {
    onChange(getCityLabel(city))
    onCitySelect?.(city.value)
    setIsSuggestOpen(false)
  }

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <div className="search-container">
        {/* Location field */}
        <div className="search-field search-field-location">
          <div className="search-input-wrapper">
            <svg
              className="search-icon"
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              type="text"
              className="search-input search-input-text"
              placeholder={t.search.placeholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => setIsSuggestOpen(true)}
              onBlur={() => window.setTimeout(() => setIsSuggestOpen(false), 120)}
            />

            {isSuggestOpen && filteredCities.length > 0 && (
              <div className="search-suggestions" role="listbox">
                <div className="search-suggestions-title">
                  {isEnglish ? 'Popular cities' : isRussian ? 'Популярные города' : 'Populyar şəhərlər'}
                </div>
                {filteredCities.map((city) => (
                  <button
                    key={city.value}
                    type="button"
                    className={`search-suggestion-item ${cityValue === city.value ? 'active' : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault()
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

        {/* Dates row */}
        <div className="search-dates">
          <div className="search-field search-field-date">
            {!checkIn && (
              <div className="search-placeholder">
                {isEnglish ? 'Check-in' : isRussian ? 'Заезд' : 'Giriş'}
              </div>
            )}
            <input
              type="date"
              className="search-input search-input-date"
              value={checkIn}
              onChange={(e) => handleCheckInChange(e.target.value)}
              aria-label={isEnglish ? 'Check-in date' : isRussian ? 'Дата заезда' : 'Giriş tarixi'}
              title={isEnglish ? 'Check-in' : isRussian ? 'Заезд' : 'Giriş'}
            />
          </div>

          <div className="search-field search-field-date">
            {!checkOut && (
              <div className="search-placeholder">
                {isEnglish ? 'Check-out' : isRussian ? 'Выезд' : 'Çıxış'}
              </div>
            )}
            <input
              type="date"
              className="search-input search-input-date"
              value={checkOut}
              min={checkIn || undefined}
              onChange={(e) => handleCheckOutChange(e.target.value)}
              aria-label={isEnglish ? 'Check-out date' : isRussian ? 'Дата выезда' : 'Çıxış tarixi'}
              title={isEnglish ? 'Check-out' : isRussian ? 'Выезд' : 'Çıxış'}
            />
          </div>

          <div className="search-field search-field-guests">
            <select
              className="search-input search-input-select"
              value={guests}
              onChange={(e) => handleGuestsChange(e.target.value)}
              title={isEnglish ? 'Guests' : isRussian ? 'Гости' : 'Qonaq'}
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5+</option>
            </select>
          </div>
        </div>
      </div>

      <div className="search-actions">
        <button type="submit" className="btn btn-accent search-btn-search">
          {t.search.button}
        </button>
        <button type="button" className="btn btn-accent search-btn-filters" onClick={onFiltersOpen}>
          {t.search.filters}
        </button>
      </div>
    </form>
  )
}
