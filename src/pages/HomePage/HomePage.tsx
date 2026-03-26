import React from 'react'
import { useLanguage } from '../../context'
import { Layout } from '../../layouts'
import { SearchBar, Filters, PropertyCard, PropertyMap, Loading } from '../../components'
import { filterProperties } from '../../data'
import { FilterState, Property } from '../../types'
import { getProperties } from '../../services'
import './HomePage.css'

const initialFilters: FilterState = {
  search: '',
  type: '',
  district: '',
  minPrice: null,
  maxPrice: null,
  rooms: null,
  hasPool: null,
  extraFilters: [],
  nearbyPlaces: [],
  city: '',
  locationCategory: 'rayon',
  locationTags: []
}

export const HomePage: React.FC = () => {
  const { t } = useLanguage()
  const [filters, setFilters] = React.useState<FilterState>(initialFilters)
  const [showMap, setShowMap] = React.useState(false)
  const [showTotalPrice, setShowTotalPrice] = React.useState(true)
  const [activeCategory, setActiveCategory] = React.useState('views')
  const [properties, setProperties] = React.useState<Property[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  const isEnglish = t.search.button === 'Search'

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
      hasPool: filters.hasPool,
      extraFilters: filters.extraFilters,
      nearbyPlaces: filters.nearbyPlaces,
      city: filters.city || undefined,
      locationCategory: filters.locationCategory,
      locationTags: filters.locationTags
    })
  }, [properties, filters])

  const handleClearFilters = () => {
    setFilters(initialFilters)
  }

  const mapLabel = showMap ? t.home.hideMap : t.home.showMap

  const premiumCategories = React.useMemo(() => ([
    { key: 'views', label: isEnglish ? 'Panoramic views' : 'Mənzərəli evlər' },
    { key: 'sea', label: isEnglish ? 'By the sea' : 'Dəniz kənarı' },
    { key: 'pools', label: isEnglish ? 'With pool' : 'Hovuzlu' },
    { key: 'farms', label: isEnglish ? 'Farm stays' : 'Təbiət evləri' },
    { key: 'treehouses', label: isEnglish ? 'Tree houses' : 'Ağac evlər' },
    { key: 'iconic', label: isEnglish ? 'Iconic places' : 'Məşhur istiqamətlər' },
    { key: 'trending', label: isEnglish ? 'Trending now' : 'Populyar seçimlər' },
    { key: 'rooms', label: isEnglish ? '3+ rooms' : '3+ otaq' }
  ]), [isEnglish])

  const applyPremiumCategory = (category: string) => {
    setActiveCategory(category)

    if (category === 'sea') {
      setFilters((prev) => ({ ...prev, nearbyPlaces: ['beach'], hasPool: null }))
      return
    }

    if (category === 'pools') {
      setFilters((prev) => ({ ...prev, hasPool: true }))
      return
    }

    if (category === 'rooms') {
      setFilters((prev) => ({ ...prev, rooms: 3 }))
      return
    }

    setFilters((prev) => ({ ...prev, nearbyPlaces: [], hasPool: null, rooms: null }))
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

          <div className="hero-category-row" role="group" aria-label="Premium categories">
            {premiumCategories.map((category) => (
              <button
                type="button"
                key={category.key}
                className={`hero-category-chip ${activeCategory === category.key ? 'active' : ''}`}
                onClick={() => applyPremiumCategory(category.key)}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="premium-results" className="section properties-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">{t.home.topListingsTitle}</h2>
            <label className="total-price-toggle">
              <span>{isEnglish ? 'Show total price' : 'Pokazyvat itogovuyu cenu'}</span>
              <button
                type="button"
                className={`total-switch ${showTotalPrice ? 'active' : ''}`}
                onClick={() => setShowTotalPrice((prev) => !prev)}
                aria-pressed={showTotalPrice}
              >
                <span className="switch-knob" />
              </button>
            </label>
          </div>

          <Filters
            filters={filters}
            onFilterChange={setFilters}
            onClear={handleClearFilters}
            hideTypeFilter={true}
            mapToggle={{
              active: showMap,
              label: mapLabel,
              onClick: () => setShowMap(!showMap)
            }}
          />

          {isLoading && <Loading message={t.messages.loading} />}

          {!isLoading && error && (
            <div className="no-results">
              <p>{error}</p>
            </div>
          )}

          {!isLoading && filteredProperties.length > 0 ? (
            <div className={`premium-results-shell ${showMap ? 'with-map' : ''}`}>
              <div className="premium-results-list">
                <div className="properties-grid premium-properties-grid">
                  {filteredProperties.map((property) => (
                    <PropertyCard key={property.id} property={property} />
                  ))}
                </div>
              </div>

              {showMap && (
                <aside className="premium-results-map">
                  <PropertyMap properties={filteredProperties} />
                </aside>
              )}
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
