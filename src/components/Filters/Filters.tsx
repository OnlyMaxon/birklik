import React from 'react'
import { useLanguage } from '../../context'
import { FilterState, PropertyType, District } from '../../types'
import { propertyTypes, districts } from '../../data'
import './Filters.css'

interface FiltersProps {
  filters: FilterState
  onFilterChange: (filters: FilterState) => void
  onClear: () => void
}

export const Filters: React.FC<FiltersProps> = ({ filters, onFilterChange, onClear }) => {
  const { t } = useLanguage()
  const [isOpen, setIsOpen] = React.useState(false)

  const handleChange = (key: keyof FilterState, value: string | number | boolean | null) => {
    onFilterChange({ ...filters, [key]: value })
  }

  const handleRoomsChange = (value: string) => {
    handleChange('rooms', value ? parseInt(value, 10) : null)
  }

  const handlePoolChange = (value: string) => {
    if (value === 'yes') handleChange('hasPool', true)
    else if (value === 'no') handleChange('hasPool', false)
    else handleChange('hasPool', null)
  }

  return (
    <div className="filters-container">
      <button 
        className="filters-toggle btn btn-outline"
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
        </svg>
        {t.search.filters}
      </button>

      <div className={`filters-panel ${isOpen ? 'open' : ''}`}>
        <div className="filters-grid">
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

          <div className="filter-group">
            <label>{t.search.district}</label>
            <select 
              value={filters.district || ''} 
              onChange={(e) => handleChange('district', e.target.value as District || '')}
            >
              <option value="">{t.search.any}</option>
              {districts.map(district => (
                <option key={district} value={district}>{t.districts[district]}</option>
              ))}
            </select>
          </div>

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

        <div className="filters-actions">
          <button className="btn btn-ghost" onClick={onClear}>
            {t.search.clearFilters}
          </button>
        </div>
      </div>
    </div>
  )
}
