import React from 'react'
import './SearchBar.css'
import { useLanguage } from '../../context'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onSearch?: () => void
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
    <form className="search-bar-card" onSubmit={handleSubmit}>
      {/* Location Field */}
      <div className="search-card-field search-location-field">
        <div className="search-field-content">
          <div className="search-field-label">
            {isEnglish ? 'Where are you going?' : isRussian ? 'Куда ты идешь?' : 'Hara gedəcəksən?'}
          </div>
          <div className="search-location-wrapper">
            <input
              type="text"
              className="search-field-input"
              placeholder={t.search.placeholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => setIsSuggestOpen(true)}
              onBlur={() => window.setTimeout(() => setIsSuggestOpen(false), 120)}
            />
            {isSuggestOpen && filteredCities.length > 0 && (
              <div className="search-suggestions" role="listbox">
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
      </div>

      {/* Dates Field */}
      <div className="search-card-field search-dates-field">
        <div className="search-field-content">
          <div className="search-dates-inputs">
            <div className="search-date-input-wrapper">
              <input
                type="date"
                className="search-field-input search-date-input"
                value={checkIn}
                onChange={(e) => handleCheckInChange(e.target.value)}
              />
              <span className="search-date-label-small">
                {isEnglish ? 'Check-in' : isRussian ? 'Заезд' : 'Giriş'}
              </span>
            </div>
            <div className="search-date-divider">—</div>
            <div className="search-date-input-wrapper">
              <input
                type="date"
                className="search-field-input search-date-input"
                value={checkOut}
                min={checkIn || undefined}
                onChange={(e) => handleCheckOutChange(e.target.value)}
              />
              <span className="search-date-label-small">
                {isEnglish ? 'Check-out' : isRussian ? 'Выезд' : 'Çıxış'}
              </span>
            </div>
          </div>
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
            <option value="1">{isEnglish ? '1 guest' : isRussian ? '1 взрослый, 0 детей' : '1 qonaq'}</option>
            <option value="2">{isEnglish ? '2 guests' : isRussian ? '2 взрослых, 0 детей' : '2 qonaq'}</option>
            <option value="3">{isEnglish ? '3 guests' : isRussian ? '3 взрослых, 0 детей' : '3 qonaq'}</option>
            <option value="4">{isEnglish ? '4 guests' : isRussian ? '4 взрослых, 0 детей' : '4 qonaq'}</option>
            <option value="5">{isEnglish ? '5+ guests' : isRussian ? '5+ взрослых' : '5+ qonaq'}</option>
          </select>
        </div>
      </div>

      {/* Search Button */}
      <button type="submit" className="search-btn-main">
        {t.search.button}
      </button>
    </form>
  )
}
