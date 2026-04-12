import React from 'react'
import { useLanguage } from '../../context'
import { FilterState, PropertyType } from '../../types'
import { propertyTypes, moreFilterOptions, nearFilterOptions, cityLocationOptions } from '../../data'
import { CityLocationPicker } from '../CityLocationPicker'
import './Filters.css'

interface FiltersProps {
  filters: FilterState
  onFilterChange: (filters: FilterState) => void
  onClear: () => void
  hideTypeFilter?: boolean
  hideFilterToggle?: boolean
  isOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
  mapToggle?: {
    active: boolean
    label: string
    onClick: () => void
  }
}

const quickMorePopular = ['sauna', 'gazebo', 'kidsZone', 'garage']
const quickNearPopular = ['beach', 'sea', 'forest', 'park']

export const Filters: React.FC<FiltersProps> = ({ filters, onFilterChange, onClear, hideTypeFilter = false, hideFilterToggle = false, isOpen = false, onOpenChange, mapToggle }) => {
  const { t, language } = useLanguage()
    const isRussian = language === 'ru'

  const [showMore, setShowMore] = React.useState(false)

  const handleToggleOpen = () => {
    onOpenChange?.(!isOpen)
  }

  const handleChange = (key: keyof FilterState, value: string | number | boolean | null) => {
    onFilterChange({ ...filters, [key]: value })
  }

  const toggleArrayValue = (key: 'extraFilters' | 'nearbyPlaces' | 'locationTags', value: string) => {
    const current = filters[key]
    const updated = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]

    onFilterChange({ ...filters, [key]: updated })
  }

  const handleRoomsChange = (value: string) => {
    handleChange('rooms', value ? parseInt(value, 10) : null)
  }

  const handlePoolChange = (value: string) => {
    if (value === 'yes') handleChange('hasPool', true)
    else if (value === 'no') handleChange('hasPool', false)
    else handleChange('hasPool', null)
  }

  const getLocalizedLabel = React.useCallback((option: { az: string; en: string }) => {
    return language === 'en' ? option.en : option.az
  }, [language])

  const sortByLabel = React.useCallback((a: { az: string; en: string }, b: { az: string; en: string }) => {
    return getLocalizedLabel(a).localeCompare(getLocalizedLabel(b), language === 'en' ? 'en' : 'az')
  }, [getLocalizedLabel, language])

  const sortedMoreOptions = React.useMemo(() => [...moreFilterOptions].sort(sortByLabel), [sortByLabel])
  const sortedNearOptions = React.useMemo(() => [...nearFilterOptions].sort(sortByLabel), [sortByLabel])

  const clearSection = (key: 'extraFilters' | 'nearbyPlaces' | 'locationTags') => {
    onFilterChange({ ...filters, [key]: [] })
  }

  const resetAdvancedOnly = () => {
    onFilterChange({
      ...filters,
      district: '',
      extraFilters: [],
      nearbyPlaces: [],
      city: '',
      locationTags: []
    })
  }

  const popularMoreOptions = sortedMoreOptions.filter((option) => quickMorePopular.includes(option.key))
  const popularNearOptions = sortedNearOptions.filter((option) => quickNearPopular.includes(option.key))
  const moreButtonLabel = language === 'en' ? 'More filters' : isRussian ? 'Доп. фильтры' : 'Əlavə filtrlər'
  const nearTitle = language === 'en' ? 'Near' : isRussian ? 'Рядом' : 'Yaxında'
  const cityLabel = language === 'en' ? 'City' : isRussian ? 'Город' : 'Şəhər'

  const moreLabelMap = new Map(sortedMoreOptions.map((item) => [item.key, getLocalizedLabel(item)]))
  const nearLabelMap = new Map(sortedNearOptions.map((item) => [item.key, getLocalizedLabel(item)]))
  const locationLabelMap = new Map(
    Object.values(cityLocationOptions)
      .flat()
      .map((item) => [item.key, getLocalizedLabel(item)])
  )

  const selectedChips = [
    ...filters.extraFilters.map((key) => ({ id: `more-${key}`, key, label: moreLabelMap.get(key) || key, group: 'extraFilters' as const })),
    ...filters.nearbyPlaces.map((key) => ({ id: `near-${key}`, key, label: nearLabelMap.get(key) || key, group: 'nearbyPlaces' as const })),
    ...(filters.city ? [{ id: `city-${filters.city}`, key: filters.city, label: `${cityLabel}: ${filters.city}`, group: 'city' as const }] : []),
    ...filters.locationTags.map((key) => ({ id: `loc-${key}`, key, label: locationLabelMap.get(key) || key, group: 'locationTags' as const }))
  ]

  const handleRemoveChip = (chip: typeof selectedChips[number]) => {
    if (chip.group === 'city') {
      onFilterChange({ ...filters, city: '' })
      return
    }

    if (chip.group === 'extraFilters' || chip.group === 'nearbyPlaces' || chip.group === 'locationTags') {
      toggleArrayValue(chip.group, chip.key)
    }
  }

  const activeBasicCount = [
    filters.type,
    filters.city,
    filters.minPrice,
    filters.maxPrice,
    filters.rooms,
    filters.hasPool === null ? null : filters.hasPool
  ].filter((item) => item !== null && item !== '').length
  const activeAdvancedCount = selectedChips.length
  const totalActiveCount = activeBasicCount + activeAdvancedCount

  return (
    <div className="filters-container">
      <div className="filters-top-row">
        {!hideFilterToggle && (
          <button
            className="filters-toggle btn btn-outline"
            onClick={handleToggleOpen}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            {t.search.filters}
            {totalActiveCount > 0 && <span className="filters-active-count">{totalActiveCount}</span>}
          </button>
        )}
        {mapToggle && (
          <button className={`btn ${mapToggle.active ? 'btn-primary' : 'btn-outline'}`} onClick={mapToggle.onClick}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            {mapToggle.label}
          </button>
        )}
      </div>

      <div className={`filters-panel ${isOpen ? 'open' : ''}`}>
        {/* City & Locations Section */}
        <div style={{ marginBottom: '1.5rem' }}>
          <CityLocationPicker
            city={filters.city}
            locationTags={filters.locationTags}
            locationCategory={filters.locationCategory}
            onCityChange={(city) => onFilterChange({ ...filters, city, locationTags: [], locationCategory: 'rayon' })}
            onLocationTagsChange={(tags) => onFilterChange({ ...filters, locationTags: tags })}
            onLocationCategoryChange={(category) => onFilterChange({ ...filters, locationCategory: category })}
          />
        </div>

        <div className="filters-grid">
          {!hideTypeFilter && (
            <div className="filter-group">
              <label>{t.search.propertyType}</label>
              <select 
                value={filters.type || ''} 
                onChange={(e) => handleChange('type', e.target.value as PropertyType || '')}
              >
                <option value="">{t.search.any}</option>
                {propertyTypes.map(type => (
                  <option key={type} value={type}>{t.propertyTypes[type]}</option>
                ))}
              </select>
            </div>
          )}

          <div className="filter-group">
            <label>{t.search.minPrice}</label>
            <input 
              type="number" 
              placeholder="0"
              value={filters.minPrice || ''} 
              onChange={(e) => handleChange('minPrice', e.target.value ? parseInt(e.target.value, 10) : null)}
            />
          </div>

          <div className="filter-group">
            <label>{t.search.maxPrice}</label>
            <input 
              type="number" 
              placeholder="1000"
              value={filters.maxPrice || ''} 
              onChange={(e) => handleChange('maxPrice', e.target.value ? parseInt(e.target.value, 10) : null)}
            />
          </div>

          <div className="filter-group">
            <label>{t.search.rooms}</label>
            <select 
              value={filters.rooms || ''} 
              onChange={(e) => handleRoomsChange(e.target.value)}
            >
              <option value="">{t.search.any}</option>
              {[1, 2, 3, 4, 5, 6, 7].map(num => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>{t.search.pool}</label>
            <select 
              value={filters.hasPool === true ? 'yes' : filters.hasPool === false ? 'no' : ''} 
              onChange={(e) => handlePoolChange(e.target.value)}
            >
              <option value="">{t.search.any}</option>
              <option value="yes">{t.search.yes}</option>
              <option value="no">{t.search.no}</option>
            </select>
          </div>
        </div>

        <div className="more-toggle-wrap">
          <button type="button" className="btn btn-accent btn-sm" onClick={() => setShowMore((prev) => !prev)}>
            {moreButtonLabel}
          </button>
        </div>

        {selectedChips.length > 0 && (
          <div className="selected-chips-row">
            {selectedChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                className="selected-chip"
                onClick={() => handleRemoveChip(chip)}
                title={language === 'en' ? 'Remove filter' : isRussian ? 'Удалить фильтр' : 'Filtri sil'}
              >
                <span>{chip.label}</span>
                <strong aria-hidden="true">×</strong>
              </button>
            ))}
          </div>
        )}

        {showMore && (
          <div className="filters-extended">
            <div className="extended-block">
              <div className="extended-header">
                <h4>{moreButtonLabel} <span className="count-pill">{filters.extraFilters.length}</span></h4>
                {filters.extraFilters.length > 0 && (
                  <button type="button" className="section-clear-btn" onClick={() => clearSection('extraFilters')}>
                    {language === 'en' ? 'Clear' : isRussian ? 'Очистить' : 'Təmizlə'}
                  </button>
                )}
              </div>
              <div className="quick-chip-row">
                {popularMoreOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`quick-chip ${filters.extraFilters.includes(option.key) ? 'active' : ''}`}
                    onClick={() => toggleArrayValue('extraFilters', option.key)}
                  >
                    {getLocalizedLabel(option)}
                  </button>
                ))}
              </div>
              <div className="chip-grid">
                {sortedMoreOptions.map((option) => (
                  <label key={option.key} className="filter-chip">
                    <input
                      type="checkbox"
                      checked={filters.extraFilters.includes(option.key)}
                      onChange={() => toggleArrayValue('extraFilters', option.key)}
                    />
                    <span>{getLocalizedLabel(option)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="extended-block">
              <div className="extended-header">
                <h4>{nearTitle} <span className="count-pill">{filters.nearbyPlaces.length}</span></h4>
                {filters.nearbyPlaces.length > 0 && (
                  <button type="button" className="section-clear-btn" onClick={() => clearSection('nearbyPlaces')}>
                    {language === 'en' ? 'Clear' : isRussian ? 'Очистить' : 'Təmizlə'}
                  </button>
                )}
              </div>
              <div className="quick-chip-row">
                {popularNearOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`quick-chip ${filters.nearbyPlaces.includes(option.key) ? 'active' : ''}`}
                    onClick={() => toggleArrayValue('nearbyPlaces', option.key)}
                  >
                    {getLocalizedLabel(option)}
                  </button>
                ))}
              </div>
              <div className="chip-grid near-grid">
                {sortedNearOptions.map((option) => (
                  <label key={option.key} className="filter-chip">
                    <input
                      type="checkbox"
                      checked={filters.nearbyPlaces.includes(option.key)}
                      onChange={() => toggleArrayValue('nearbyPlaces', option.key)}
                    />
                    <span>{getLocalizedLabel(option)}</span>
                  </label>
                ))}
              </div>
            </div>

          </div>
        )}

        <div className="filters-actions">
          <button className="btn btn-ghost" onClick={resetAdvancedOnly}>
            {language === 'en' ? 'Reset advanced' : isRussian ? 'Сбросить доп. фильтры' : 'Əlavə filtrləri təmizlə'}
          </button>
          <button className="btn btn-ghost" onClick={onClear}>
            {t.search.clearFilters}
          </button>
        </div>
      </div>
    </div>
  )
}
