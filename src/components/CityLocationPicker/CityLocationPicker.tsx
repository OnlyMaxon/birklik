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



  const handleCityChange = (newCity: string) => {
    onCityChange(newCity)
    onLocationTagsChange([])
    setLocationSearch('')
  }

  const handleCategoryChange = (category: LocationCategory) => {
    onLocationCategoryChange?.(category)
    setLocationSearch('')
  }

  const handleLocationToggle = (tag: string, category: LocationCategory) => {
    // For Baku: only allow 1 rayon + 1 metro (mutually exclusive within category)
    // For other cities: only allow 1 rayon
    if (city === 'Baku') {
      // Get all rayons and metros currently selected
      const rayonOptions = cityLocationOptions['rayon'] || []
      const metroOptions = cityLocationOptions['metro'] || []
      
      const selectedRayons = locationTags.filter(t => rayonOptions.some(opt => opt.key === t))
      const selectedMetros = locationTags.filter(t => metroOptions.some(opt => opt.key === t))

      if (category === 'rayon') {
        // When selecting a rayon, deselect any other rayon and keep metro
        const newRayons = selectedRayons.includes(tag) ? [] : [tag]
        const updated = [...newRayons, ...selectedMetros]
        onLocationTagsChange(updated)
      } else {
        // When selecting metro, deselect any other metro and keep rayon
        const newMetros = selectedMetros.includes(tag) ? [] : [tag]
        const updated = [...selectedRayons, ...newMetros]
        onLocationTagsChange(updated)
      }
    } else {
      // For other cities: only rayons allowed, max 1
      const updated = locationTags.includes(tag) ? [] : [tag]
      onLocationTagsChange(updated)
    }
  }

  const getCityLabel = (cityObj: { value: string; en: string; ru: string; az: string }) => {
    return language === 'en' ? cityObj.en : language === 'ru' ? cityObj.ru : cityObj.az
  }

  const getLocationLabel = (option: { key: string; en: string; az: string }) => {
    return language === 'en' ? option.en : option.az
  }

  const filteredLocations = city === 'Baku'
    ? (() => {
        // For Baku, show locations from current category but also include selected tags from other categories
        const currentCategoryOptions = cityLocationOptions[locationCategory]?.filter((option) =>
          !locationSearch ||
          option.az.toLowerCase().includes(locationSearch.toLowerCase()) ||
          option.en.toLowerCase().includes(locationSearch.toLowerCase())
        ) || []
        
        // Also get the other category to find selected tags
        const otherCategory = locationCategory === 'rayon' ? 'metro' : 'rayon'
        const otherCategoryOptions = cityLocationOptions[otherCategory] || []
        
        // Find any selected tags from the other category
        const selectedFromOther = locationTags.filter(tag => 
          otherCategoryOptions.some(opt => opt.key === tag)
        )
        
        // Combine: show current category options + any selected from other category
        const combined = [...currentCategoryOptions]
        selectedFromOther.forEach(tag => {
          if (!combined.find(opt => opt.key === tag)) {
            const foundOption = otherCategoryOptions.find(opt => opt.key === tag)
            if (foundOption) combined.push(foundOption)
          }
        })
        
        return combined
      })()
    : (cityDistricts[city as keyof typeof cityDistricts] || []).map((district) => ({
        key: district,
        en: district,
        az: district
      }))



  return (
    <div className="form-group full-width">
      {/* City Select */}
      <label>
        {language === 'en' ? 'City' : language === 'ru' ? 'Город' : 'Şəhər'} *
      </label>
      <select 
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
        <div className="location-tags-section-inner">
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
                  onChange={() => handleLocationToggle(option.key, locationCategory)}
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
