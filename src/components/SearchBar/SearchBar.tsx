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
  activeFilterCount?: number
}

const CITY_SUGGESTIONS = [
  { value: 'Baku', az: 'Bakı', en: 'Baku', ru: 'Баку' },
  { value: 'Ganja', az: 'Gəncə', en: 'Ganja', ru: 'Гянджа' },
  { value: 'Sumqayit', az: 'Sumqayıt', en: 'Sumqayit', ru: 'Сумгайыт' },
  { value: 'Quba', az: 'Quba', en: 'Quba', ru: 'Губа' },
  { value: 'Shaki', az: 'Şəki', en: 'Shaki', ru: 'Шеки' },
  { value: 'Lahij', az: 'Lahij', en: 'Lahij', ru: 'Лахиджь' },
  { value: 'Gabala', az: 'Qəbələ', en: 'Gabala', ru: 'Габала' },
  { value: 'Ismayilli', az: 'İsmayıllı', en: 'Ismayilli', ru: 'Исмаиллы' },
  { value: 'Shamakhi', az: 'Şamaxı', en: 'Shamakhi', ru: 'Шамаха' },
  { value: 'Balakan', az: 'Balakən', en: 'Balakan', ru: 'Балакан' },
  { value: 'Zaqatala', az: 'Zaqatala', en: 'Zaqatala', ru: 'Загатала' },
  { value: 'Oghuz', az: 'Oğuz', en: 'Oghuz', ru: 'Огуз' },
  { value: 'Shaki District', az: 'Şəki Rayon', en: 'Shaki District', ru: 'Район Шеки' },
  { value: 'Gakhistan', az: 'Qaxistan', en: 'Gakhistan', ru: 'Кахистан' },
  { value: 'Khachmaz', az: 'Xaçmaz', en: 'Khachmaz', ru: 'Хачмаз' },
  { value: 'Yardymly', az: 'Yardımly', en: 'Yardymly', ru: 'Ярдымлы' },
  { value: 'Masally', az: 'Masallı', en: 'Masally', ru: 'Масаллы' },
  { value: 'Lankaran', az: 'Lənkəran', en: 'Lankaran', ru: 'Ленкорань' },
  { value: 'Lerik', az: 'Lerik', en: 'Lerik', ru: 'Лерик' },
  { value: 'Astara', az: 'Astara', en: 'Astara', ru: 'Астара' },
  { value: 'Jalilabad', az: 'Cəlilabad', en: 'Jalilabad', ru: 'Джалилабад' },
  { value: 'Bilasuvar', az: 'Biləsuvar', en: 'Bilasuvar', ru: 'Биласувар' },
  { value: 'Sabirabad', az: 'Sabirabd', en: 'Sabirabad', ru: 'Сабирабад' },
  { value: 'Saatly', az: 'Saatly', en: 'Saatly', ru: 'Саатлы' },
  { value: 'Imishli', az: 'İmişli', en: 'Imishli', ru: 'Имишли' },
  { value: 'Agjabadi', az: 'Ağcəbədi', en: 'Agjabadi', ru: 'Агджабади' },
  { value: 'Beylagan', az: 'Beyləqan', en: 'Beylagan', ru: 'Бейлеган' },
  { value: 'Mingachevir', az: 'Mingəçevir', en: 'Mingachevir', ru: 'Мингечевир' },
  { value: 'Yevlakh', az: 'Yevlax', en: 'Yevlakh', ru: 'Евлах' },
  { value: 'Terter', az: 'Tərtar', en: 'Terter', ru: 'Тартар' },
  { value: 'Goranboy', az: 'Göranboy', en: 'Goranboy', ru: 'Геранбой' },
  { value: 'Dashkesan', az: 'Daşkəsən', en: 'Dashkesan', ru: 'Дашкесен' },
  { value: 'Shamirvan', az: 'Şamirvan', en: 'Shamirvan', ru: 'Шамирван' },
  { value: 'Shirvan', az: 'Şirvan', en: 'Shirvan', ru: 'Ширван' },
  { value: 'Shusha', az: 'Şuşa', en: 'Shusha', ru: 'Шуша' },
  { value: 'Lachin', az: 'Laçın', en: 'Lachin', ru: 'Лачин' },
  { value: 'Kalbajar', az: 'Kəlbəcər', en: 'Kalbajar', ru: 'Кельбаджар' },
  { value: 'Khojavend', az: 'Xocavənd', en: 'Khojavend', ru: 'Ходжавенд' },
  { value: 'Khojavand', az: 'Xocavənd', en: 'Khojavand', ru: 'Ходжавенд' },
  { value: 'Fuzuli', az: 'Füzuli', en: 'Fuzuli', ru: 'Физули' },
  { value: 'Jabrayil', az: 'Cəbrayıl', en: 'Jabrayil', ru: 'Джебраил' },
  { value: 'Naxchivan', az: 'Naxçıvan', en: 'Naxchivan', ru: 'Нахчыван' }
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
  onGuestsChange,
  activeFilterCount = 0
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
