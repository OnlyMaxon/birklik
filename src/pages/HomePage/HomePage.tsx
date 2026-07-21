import React from 'react'
import type { DocumentSnapshot } from 'firebase/firestore'
import { useLanguage } from '../../context'
import { Layout } from '../../layouts'
import { SearchBar, Filters, PropertyCard, Loading } from '../../components'
import { filterProperties } from '../../data'
import { FilterState, Property } from '../../types'
import { getProperties, getAllPremiumProperties } from '../../services'
import './HomePage.css'

const PropertyMap = React.lazy(() =>
  import('../../components/Map').then((mod) => ({ default: mod.PropertyMap }))
)

const initialFilters: FilterState = {
  search: '',
  checkIn: '',
  checkOut: '',
  minGuests: null,
  maxGuests: null,
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
  const [showMap, setShowMap] = React.useState(() => window.innerWidth < 1280)
  const [showFilters, setShowFilters] = React.useState(false)
  const [viewMode, setViewMode] = React.useState<'normal' | 'compact'>('normal')
  const [properties, setProperties] = React.useState<Property[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isLoadingMore, setIsLoadingMore] = React.useState(false)
  const [, setHasMore] = React.useState(false)
  const [error, setError] = React.useState('')
  const resultsRef = React.useRef<HTMLElement | null>(null)
  const lastDocRef = React.useRef<DocumentSnapshot | null>(null)
  const hasMoreRef = React.useRef(false)
  const isLoadingMoreRef = React.useRef(false)
  // IDs of VIP/Premium already loaded — used to deduplicate paginated standard results
  const premiumIdsRef = React.useRef<Set<string>>(new Set())

  React.useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError('')
      setProperties([])
      setHasMore(false)
      lastDocRef.current = null
      hasMoreRef.current = false
      premiumIdsRef.current = new Set()

      const cityFilter = filters.city ? { city: filters.city } : undefined

      const [premiums, standardResult] = await Promise.all([
        getAllPremiumProperties(cityFilter),
        getProperties(cityFilter),
      ])
      if (cancelled) return

      const premiumIds = new Set(premiums.map(p => p.id))
      premiumIdsRef.current = premiumIds
      const dedupedStandard = standardResult.properties.filter(p => !premiumIds.has(p.id))

      setProperties([...premiums, ...dedupedStandard])
      lastDocRef.current = standardResult.lastDoc
      hasMoreRef.current = standardResult.lastDoc !== null
      setHasMore(standardResult.lastDoc !== null)
      setIsLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [filters.city])

  const loadMore = React.useCallback(async () => {
    if (isLoadingMoreRef.current || !hasMoreRef.current || !lastDocRef.current) return

    isLoadingMoreRef.current = true
    setIsLoadingMore(true)

    const result = await getProperties(
      filters.city ? { city: filters.city } : undefined,
      lastDocRef.current
    )

    const dedupedNew = result.properties.filter(p => !premiumIdsRef.current.has(p.id))
    setProperties(prev => [...prev, ...dedupedNew])
    lastDocRef.current = result.lastDoc
    hasMoreRef.current = result.lastDoc !== null
    setHasMore(result.lastDoc !== null)
    isLoadingMoreRef.current = false
    setIsLoadingMore(false)
  }, [filters.city])

  React.useEffect(() => {
    if (isLoading) return

    const THRESHOLD = 500

    const check = () => {
      if (isLoadingMoreRef.current || !hasMoreRef.current) return
      if (document.documentElement.scrollHeight - window.scrollY - window.innerHeight < THRESHOLD) {
        loadMore()
      }
    }

    window.addEventListener('scroll', check, { passive: true })
    return () => { window.removeEventListener('scroll', check) }
  }, [loadMore, isLoading])

  const filteredProperties = React.useMemo(() => {
    return filterProperties(properties, {
      search: filters.search,
      checkIn: filters.checkIn || undefined,
      checkOut: filters.checkOut || undefined,
      minGuests: filters.minGuests || undefined,
      maxGuests: filters.maxGuests || undefined,
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

  const handleFiltersOpen = () => {
    if (!showFilters) {
      setShowFilters(true)
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      setShowFilters(false)
    }
  }

  const activeFilterCount = [
    filters.type,
    filters.city,
    filters.district,
    filters.minPrice,
    filters.maxPrice,
    filters.rooms,
    filters.minGuests,
    filters.maxGuests,
    filters.hasPool === null ? null : filters.hasPool
  ].filter((item) => item !== null && item !== '').length +
  filters.extraFilters.length +
  filters.nearbyPlaces.length +
  filters.locationTags.length

  const mapLabel = showMap ? t.home.hideMap : t.home.showMap

  const handleSearchSubmit = () => {
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <Layout>
      <section className="hero">
        <img
          src="/hero.jpeg"
          sizes="100vw"
          className="hero-bg-img"
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          loading="eager"
          width="1920"
          height="1080"
        />
        <div className="container hero-content">
          <div className="hero-search-shell">
            <p className="hero-tagline">{t.hero.tagline}</p>
            <SearchBar
              onChange={(value: string) => setFilters({ ...filters, search: value })}
              cityValue={filters.city}
              onCitySelect={(city: string) => setFilters({ ...filters, city })}
              checkInValue={filters.checkIn}
              checkOutValue={filters.checkOut}
              minGuestsValue={filters.minGuests}
              maxGuestsValue={filters.maxGuests}
              onDateChange={(checkIn: string, checkOut: string) => setFilters({ ...filters, checkIn, checkOut })}
              onMinGuestsChange={(guests: number) => setFilters({ ...filters, minGuests: guests })}
              onMaxGuestsChange={(guests: number | string) => setFilters({ ...filters, maxGuests: guests })}
              onSearch={handleSearchSubmit}
              onFiltersOpen={handleFiltersOpen}
              activeFilterCount={activeFilterCount}
            />
          </div>
        </div>
      </section>

      <section id="premium-results" className="section properties-section" ref={resultsRef}>
        <div className="properties-content">
          <aside className="ad-slot ad-slot--left" aria-label="Reklam">
            <img
              src="/ads/banner.jpg"
              width={160}
              height={600}
              alt="Reklam"
              style={{ display: 'block', borderRadius: '14px' }}
            />
          </aside>

          <div className="container">
            <Filters
              filters={filters}
              onFilterChange={setFilters}
              onClear={handleClearFilters}
              hideTypeFilter={true}
              hideFilterToggle={true}
              isOpen={showFilters}
              onOpenChange={setShowFilters}
              mapToggle={{
                active: showMap,
                label: mapLabel,
                onClick: () => setShowMap(!showMap)
              }}
              viewToggle={{
                mode: viewMode,
                onToggle: setViewMode
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
                  <div className={`properties-grid premium-properties-grid${viewMode === 'compact' ? ' compact-view' : ''}`}>
                    {filteredProperties.map((property, index) => (
                      <PropertyCard
                        key={property.id}
                        property={property}
                        checkIn={filters.checkIn}
                        checkOut={filters.checkOut}
                        isCompact={viewMode === 'compact'}
                        priority={index < 4}
                      />
                    ))}
                  </div>
                  {isLoadingMore && <Loading message="" />}
                </div>

                {showMap && (
                  <aside className="premium-results-map">
                    <React.Suspense fallback={<div className="pp-map-loading" />}>
                      <PropertyMap properties={filteredProperties} />
                    </React.Suspense>
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

          <aside className="ad-slot ad-slot--right" aria-label="Reklam">
            <img
              src="/ads/banner.jpg"
              width={160}
              height={600}
              alt="Reklam"
              style={{ display: 'block', borderRadius: '14px' }}
            />
          </aside>
        </div>
      </section>
    </Layout>
  )
}
