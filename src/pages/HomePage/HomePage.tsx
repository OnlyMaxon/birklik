import React from 'react'
import { useLanguage } from '../../context'
import { Layout } from '../../layouts'
import { SearchBar, Filters, PropertyCard, PropertyMap, Loading } from '../../components'
import { filterProperties } from '../../data'
import { FilterState, Property, PropertyType } from '../../types'
import { getProperties } from '../../services'
import './HomePage.css'

const initialFilters: FilterState = {
  search: '',
  type: '',
  district: '',
  minPrice: null,
  maxPrice: null,
  rooms: null,
  hasPool: null
}

type TypeFilterCard = {
  key: string
  type: PropertyType | ''
  icon: string
  label: string
}

export const HomePage: React.FC = () => {
  const { t, language } = useLanguage()
  const [filters, setFilters] = React.useState<FilterState>(initialFilters)
  const [showMap, setShowMap] = React.useState(false)
  const [properties, setProperties] = React.useState<Property[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    const loadProperties = async () => {
      setIsLoading(true)
      setError('')

      const result = await getProperties()
      if (result.properties.length === 0) {
        setError('')
      }
      setProperties(result.properties)
      setIsLoading(false)
    }

    loadProperties()
  }, [])

  const filteredProperties = React.useMemo(() => {
    return filterProperties(properties, {
      search: filters.search,
      type: filters.type || undefined,
      district: filters.district || undefined,
      minPrice: filters.minPrice || undefined,
      maxPrice: filters.maxPrice || undefined,
      rooms: filters.rooms || undefined,
      hasPool: filters.hasPool
    })
  }, [properties, filters])

  const handleClearFilters = () => {
    setFilters(initialFilters)
  }

  const mapLabel = showMap ? t.home.hideMap : t.home.showMap

  const typeFilterCards: TypeFilterCard[] = [
    { key: 'apartment', type: 'apartment', icon: '🏢', label: t.propertyTypes.apartment },
    { key: 'villa', type: 'villa', icon: '🏡', label: t.propertyTypes.villa },
    { key: 'cottage', type: 'cottage', icon: '🏘️', label: language === 'en' ? 'Holiday homes' : 'Bağ evləri' }
  ]

  const handleTypeCardSelect = (type: PropertyType | '') => {
    setFilters(prev => ({ ...prev, type }))
  }

  return (
    <Layout>
      <section className="hero">
        <div className="hero-overlay"></div>
        <div className="hero-pattern"></div>
        <div className="container hero-content">
          <p className="hero-kicker">Birklik.az</p>
          <h1 className="hero-title">{t.hero.title}</h1>
          <p className="hero-subtitle">{t.hero.subtitle}</p>
          <SearchBar
            value={filters.search}
            onChange={(value) => setFilters({ ...filters, search: value })}
          />

          <div className="hero-type-filters" role="group" aria-label="Type filters">
            {typeFilterCards.map((card) => (
              <button
                type="button"
                className={`hero-type-card ${filters.type === card.type ? 'active' : ''}`}
                key={card.key}
                onClick={() => handleTypeCardSelect(card.type)}
              >
                <span className="hero-type-icon" aria-hidden="true">{card.icon}</span>
                <span className="hero-type-label">{card.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="section properties-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">{t.home.topListingsTitle}</h2>
            <button
              className={`btn ${showMap ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setShowMap(!showMap)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              {mapLabel}
            </button>
          </div>

          <Filters
            filters={filters}
            onFilterChange={setFilters}
            onClear={handleClearFilters}
            hideTypeFilter={true}
          />

          {isLoading && <Loading message={t.messages.loading} />}

          {!isLoading && error && (
            <div className="no-results">
              <p>{error}</p>
            </div>
          )}

          {!isLoading && showMap && (
            <div className="map-section mb-6">
              <PropertyMap properties={filteredProperties} />
            </div>
          )}

          {!isLoading && filteredProperties.length > 0 ? (
            <div className="properties-grid grid grid-4">
              {filteredProperties.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          ) : !isLoading && !error ? (
            <div className="no-results">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.3-4.3"/>
                <path d="M8 11h6"/>
              </svg>
              <p>{t.messages.noResults}</p>
              <button className="btn btn-outline" onClick={handleClearFilters}>
                {t.search.clearFilters}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </Layout>
  )
}
