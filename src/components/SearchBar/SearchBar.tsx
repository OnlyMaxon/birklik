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
  onDateChange?: (checkIn: string, checkOut: string) => void
}

const CITY_SUGGESTIONS = ['Baku', 'Sumqayit', 'Gabala', 'Quba']

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onSearch,
  cityValue = '',
  onCitySelect,
  checkInValue = '',
  checkOutValue = '',
  onDateChange
}) => {
  const { t, language } = useLanguage()
  const [checkIn, setCheckIn] = React.useState(checkInValue)
  const [checkOut, setCheckOut] = React.useState(checkOutValue)
  const [guests, setGuests] = React.useState('1')
  const [isSuggestOpen, setIsSuggestOpen] = React.useState(false)

  React.useEffect(() => {
    setCheckIn(checkInValue)
  }, [checkInValue])

  React.useEffect(() => {
    setCheckOut(checkOutValue)
  }, [checkOutValue])

  React.useEffect(() => {
    onDateChange?.(checkIn, checkOut)
  }, [checkIn, checkOut, onDateChange])

  const normalizedQuery = value.trim().toLowerCase()
  const filteredCities = CITY_SUGGESTIONS.filter((city) => {
    if (!normalizedQuery) return true
    return city.toLowerCase().includes(normalizedQuery)
  }).slice(0, 6)

  const whereToLabel = language === 'en' ? 'Where to?' : language === 'ru' ? 'Куда?' : 'Hara?'
  const checkInLabel = language === 'en' ? 'Check-in' : language === 'ru' ? 'Заезд' : 'Giriş tarixi'
  const checkOutLabel = language === 'en' ? 'Check-out' : language === 'ru' ? 'Выезд' : 'Çıxış tarixi'
  const guestsLabel = language === 'en' ? 'Guests' : language === 'ru' ? 'Гости' : 'Qonaq sayı'
  const suggestionsTitle = language === 'en'
    ? 'Popular cities'
    : language === 'ru'
      ? 'Популярные города'
      : 'Populyar şəhərlər'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch?.()
  }

  const handlePickCity = (city: string) => {
    onChange(city)
    onCitySelect?.(city)
    setIsSuggestOpen(false)
  }

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <div className="search-grid">
        <div className="search-field search-field-destination">
          <label>{whereToLabel}</label>
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
              className="search-input"
              placeholder={t.search.placeholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => setIsSuggestOpen(true)}
              onBlur={() => {
                window.setTimeout(() => setIsSuggestOpen(false), 120)
              }}
            />

            {isSuggestOpen && filteredCities.length > 0 && (
              <div className="search-suggestions" role="listbox">
                <div className="search-suggestions-title">{suggestionsTitle}</div>
                {filteredCities.map((city) => (
                  <button
                    key={city}
                    type="button"
                    className={`search-suggestion-item ${cityValue === city ? 'active' : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handlePickCity(city)
                    }}
                  >
                    {city}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="search-field">
          <label>{checkInLabel}</label>
          <input
            type="date"
            className="search-input"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
          />
        </div>

        <div className="search-field">
          <label>{checkOutLabel}</label>
          <input
            type="date"
            className="search-input"
            value={checkOut}
            min={checkIn || undefined}
            onChange={(e) => setCheckOut(e.target.value)}
          />
        </div>

        <div className="search-field">
          <label>{guestsLabel}</label>
          <select
            className="search-input"
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5+</option>
          </select>
        </div>
      </div>
      <button type="submit" className="btn btn-accent search-submit-btn">
        {t.search.button}
      </button>
    </form>
  )
}
