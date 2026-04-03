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
  guestsValue?: '1-10' | '10+' | null
  onDateChange?: (checkIn: string, checkOut: string) => void
  onGuestsChange?: (guests: '1-10' | '10+') => void
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
  guestsValue = '1-10',
  onDateChange,
  onGuestsChange,
  activeFilterCount = 0
}) => {
  const { t, language } = useLanguage()
  const [checkIn, setCheckIn] = React.useState(checkInValue)
  const [checkOut, setCheckOut] = React.useState(checkOutValue)
  const [guests, setGuests] = React.useState(guestsValue || '1-10')
  const [isSuggestOpen, setIsSuggestOpen] = React.useState(false)
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
    setGuests(guestsValue || '1-10')
  }, [guestsValue])

  const normalizedQuery = citySearchText.trim().toLowerCase()
  const filteredCities = cities.filter((city) => {
    if (!normalizedQuery) return true
    return [city.value, city.az, city.en, city.ru].some((label) => label.toLowerCase().includes(normalizedQuery))
  }).slice(0, cityFilterLimit)

  const handleGuestsChange = (nextGuests: string) => {
    setGuests(nextGuests as '1-10' | '10+')
    onGuestsChange?.(nextGuests as '1-10' | '10+')
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
          <div className="search-field-label">
            {isEnglish ? 'When?' : isRussian ? 'Когда?' : 'Nə vaxt?'}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => {
                setCheckIn(e.target.value)
                onDateChange?.(e.target.value, checkOut)
              }}
              style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid #e0e0e0' }}
            />
            <span style={{ color: '#999' }}>→</span>
            <input
              type="date"
              value={checkOut}
              onChange={(e) => {
                setCheckOut(e.target.value)
                onDateChange?.(checkIn, e.target.value)
              }}
              style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid #e0e0e0' }}
            />
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
            <option value="1-10">{isEnglish ? '1-10 guests' : isRussian ? '1-10 гостей' : '1-10 qonaq'}</option>
            <option value="10+">{isEnglish ? '10+ guests' : isRussian ? '10+ гостей' : '10+ qonaq'}</option>
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
    </form>
  )
}
