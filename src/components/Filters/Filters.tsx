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
  onSearch?: () => void
  mapToggle?: {
    active: boolean
    label: string
    onClick: () => void
  }
  viewToggle?: {
    mode: 'normal' | 'compact'
    onToggle: (mode: 'normal' | 'compact') => void
  }
}

const quickMorePopular = ['sauna', 'gazebo', 'kidsZone', 'garage']
const quickNearPopular = ['beach', 'sea', 'forest', 'park']

export const Filters: React.FC<FiltersProps> = ({ filters, onFilterChange, onClear, hideTypeFilter = false, hideFilterToggle = false, isOpen = false, onOpenChange, onSearch, mapToggle, viewToggle }) => {
  const { t, language } = useLanguage()

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

  const getLocalizedLabel = React.useCallback((option: { key: string }) => {
    if (!t || !t.amenities) return option.key
    return (t.amenities as Record<string, string>)[option.key] || option.key
  }, [t])

  const sortByLabel = React.useCallback((a: { key: string }, b: { key: string }) => {
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
  const moreButtonLabel = t.search.moreFilters
  const nearTitle = t.search.near
  const cityLabel = t.search.city

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
        {onSearch && (
          <button className="btn btn-primary" onClick={onSearch} title={t.search.button}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            {t.search.button}
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
        {viewToggle && (
          <button
            className={`btn ${viewToggle.mode === 'compact' ? 'btn-primary' : 'btn-outline'} view-toggle-btn`}
            onClick={() => viewToggle.onToggle(viewToggle.mode === 'compact' ? 'normal' : 'compact')}
            title={viewToggle.mode === 'compact'
              ? (language === 'en' ? 'Normal view' : language === 'ru' ? 'Обычный вид' : 'Normal görünüş')
              : (language === 'en' ? 'Compact view' : language === 'ru' ? 'Компактный вид' : 'Kompakt görünüş')}
          >
            {viewToggle.mode === 'compact' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="9" height="9"/><rect x="13" y="2" width="9" height="9"/><rect x="2" y="13" width="9" height="9"/><rect x="13" y="13" width="9" height="9"/>
              </svg>
            )}
            {viewToggle.mode === 'compact'
              ? (language === 'en' ? 'Normal' : language === 'ru' ? 'Обычный' : 'Normal')
              : (language === 'en' ? 'Compact' : language === 'ru' ? 'Компактный' : 'Kompakt')}
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
                title={t.filters.removeFilter}
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
                    {t.buttons.clear}
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
                    {t.buttons.clear}
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
          <div className="filters-actions-left">
            <button className="btn btn-ghost" onClick={resetAdvancedOnly}>
              {t.filters.resetAdvanced}
            </button>
            {onSearch && (
              <button className="btn btn-primary filters-search-btn" onClick={onSearch}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35"/>
                </svg>
                {t.search.button}
              </button>
            )}
          </div>
          <button className="btn btn-ghost" onClick={onClear}>
            {t.search.clearFilters}
          </button>
        </div>
      </div>
    </div>
  )
}
