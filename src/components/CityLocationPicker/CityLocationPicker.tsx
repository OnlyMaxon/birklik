import React from 'react'
import { useLanguage } from '../../context'
import { cityLocationOptions, cities, cityDistricts } from '../../data'
import { LocationCategory } from '../../types'

interface CityLocationPickerProps {
  city: string
  locationTags: string[]
  locationCategory?: LocationCategory
  onCityChange: (city: string) => void
  onLocationTagsChange: (tags: string[]) => void
  onLocationCategoryChange?: (category: LocationCategory) => void
}

export const CityLocationPicker: React.FC<CityLocationPickerProps> = ({
  city,
  locationTags,
  locationCategory = 'rayon',
  onCityChange,
  onLocationTagsChange,
  onLocationCategoryChange
}) => {
  const { language } = useLanguage()
  const [locationSearch, setLocationSearch] = React.useState('')

  // Debug logging
  React.useEffect(() => {
    console.log('[CityLocationPicker] city prop is NOW:', city, 'locationCategory:', locationCategory)
    console.log('[CityLocationPicker] cityDistricts[city]:', cityDistricts[city as keyof typeof cityDistricts])
    console.log('[CityLocationPicker] cityLocationOptions:', cityLocationOptions)
  }, [city, locationCategory])

  const handleCityChange = (newCity: string) => {
    console.log('[CityLocationPicker] handleCityChange called with:', newCity)
    console.log('[CityLocationPicker] About to call onCityChange callback')
    onCityChange(newCity)
    console.log('[CityLocationPicker] Called onCityChange, now resetting tags')
    onLocationTagsChange([])
    setLocationSearch('')
  }

  const handleCategoryChange = (category: LocationCategory) => {
    onLocationCategoryChange?.(category)
    onLocationTagsChange([])
    setLocationSearch('')
  }

  const handleLocationToggle = (tag: string) => {
    const updated = locationTags.includes(tag)
      ? locationTags.filter((t) => t !== tag)
      : [...locationTags, tag]
    onLocationTagsChange(updated)
  }

  const getCityLabel = (cityObj: { value: string; en: string; ru: string; az: string }) => {
    return language === 'en' ? cityObj.en : language === 'ru' ? cityObj.ru : cityObj.az
  }

  const getLocationLabel = (option: { key: string; en: string; az: string }) => {
    return language === 'en' ? option.en : option.az
  }

  const filteredLocations = city === 'Baku'
    ? cityLocationOptions[locationCategory]
        ?.filter((option) =>
          !locationSearch ||
          option.az.toLowerCase().includes(locationSearch.toLowerCase()) ||
          option.en.toLowerCase().includes(locationSearch.toLowerCase())
        ) || []
    : (cityDistricts[city as keyof typeof cityDistricts] || []).map((district) => ({
        key: district,
        en: district,
        az: district
      }))

  React.useEffect(() => {
    console.log('[CityLocationPicker] city/category changed:', city, locationCategory)
  }, [city, locationCategory])

  React.useEffect(() => {
    console.log('[CityLocationPicker] filteredLocations:', filteredLocations.length, 'entries for city:', city)
  }, [filteredLocations, city])

  return (
    <div className="form-group full-width">
      {/* City Select */}
      <label>
        {language === 'en' ? 'City' : language === 'ru' ? 'Город' : 'Şəhər'} *
      </label>
      <select 
        key={`city-select-${city}`}
        value={city || ''} 
        onChange={(e) => handleCityChange(e.target.value)} 
        required 
        style={{ marginBottom: city ? '1.5rem' : 0 }}>
        <option value="">
          {language === 'en' ? 'Select a city' : language === 'ru' ? 'Выберите город' : 'Şəhər seçin'}
        </option>
        {cities.map((cityObj) => (
          <option key={cityObj.value} value={cityObj.value}>
            {getCityLabel(cityObj)}
          </option>
        ))}
      </select>

      {/* Location Tags - only show if city selected and it has locations */}
      {city && (cityDistricts[city as keyof typeof cityDistricts] || city === 'Baku') && (
        <div key={`locations-${city}-${locationCategory}`} className="location-tags-section-inner">
          <div className="dashboard-section-head">
            <label>
              {language === 'en'
                ? 'City locations'
                : language === 'ru'
                  ? 'Локации по городу'
                  : 'Şəhərdaxili lokasiya seçimi'}{' '}
              <span className="dashboard-count-pill">{locationTags.length}</span>
            </label>
            {locationTags.length > 0 && (
              <button
                type="button"
                className="dashboard-section-clear"
                onClick={() => {
                  onLocationTagsChange([])
                }}
              >
                {language === 'en' ? 'Clear' : language === 'ru' ? 'Очистить' : 'Təmizlə'}
              </button>
            )}
          </div>

          {/* Category Toggle for Baku */}
          {city === 'Baku' && (
            <div className="city-category-toggle" style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className={`btn btn-sm ${locationCategory === 'rayon' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => handleCategoryChange('rayon')}
              >
                {language === 'en' ? 'Districts' : language === 'ru' ? 'Районы' : 'Rayonlar'}
              </button>
              <button
                type="button"
                className={`btn btn-sm ${locationCategory === 'metro' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => handleCategoryChange('metro')}
              >
                {language === 'en' ? 'Metro' : language === 'ru' ? 'Метро' : 'Metro'}
              </button>
            </div>
          )}

          {/* Location Search */}
          <input
            type="search"
            placeholder={
              language === 'en'
                ? 'Search district, metro, landmark'
                : language === 'ru'
                  ? 'Поиск по району, метро, ориентиру'
                  : 'Rayon, metro, nişangah axtarın'
            }
            value={locationSearch}
            onChange={(e) => setLocationSearch(e.target.value)}
            style={{ marginBottom: '12px' }}
          />

          {/* Location Options */}
          <div className="city-option-list">
            {filteredLocations.map((option) => (
              <label key={option.key} className="city-option-item">
                <input
                  type="checkbox"
                  checked={locationTags.includes(option.key)}
                  onChange={() => handleLocationToggle(option.key)}
                />
                <span>{getLocationLabel(option)}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
