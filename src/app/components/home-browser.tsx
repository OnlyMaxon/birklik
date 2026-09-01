'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import {OptimizedImage} from '@/components/optimized-image'
import { useLanguage } from '@/components/providers'
import {CardsSkeleton, InlineSpinner, MapSkeleton, PropertyCard} from '@/components'
import {SearchBar} from './search-bar'
import {Filters} from './filters'
import { filterProperties } from '@/data'
import { FilterState, Property } from '@/types'
import { refreshPropertiesAction, loadMorePropertiesAction } from '../actions'
import type { PropertyCursor } from '../queries'

const PropertyMap = dynamic(
  () => import('@/components/map').then(module => module.PropertyMap),
  {ssr: false, loading: () => <MapSkeleton />}
)

const initialFilters: FilterState = {
  search: '',
  checkIn: '',
  checkOut: '',
  minGuests: null,
  maxGuests: null,
  type: '',
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

interface HomeBrowserProps {
  initialPremium: Property[]
  initialStandard: Property[]
  initialCursor: PropertyCursor | null
}

export const HomeBrowser: React.FC<HomeBrowserProps> = ({ initialPremium, initialStandard, initialCursor }) => {
  const { t } = useLanguage()
  const [filters, setFilters] = React.useState<FilterState>(initialFilters)
  const [showMap, setShowMap] = React.useState(false)
  const [showFilters, setShowFilters] = React.useState(false)
  const [viewMode, setViewMode] = React.useState<'normal' | 'compact'>('normal')
  const [properties, setProperties] = React.useState<Property[]>([...initialPremium, ...initialStandard])
  const [isLoading, setIsLoading] = React.useState(false)
  const [isLoadingMore, setIsLoadingMore] = React.useState(false)
  const [, setHasMore] = React.useState(initialCursor !== null)
  const [error, setError] = React.useState('')
  const resultsRef = React.useRef<HTMLElement | null>(null)
  const lastDocRef = React.useRef<PropertyCursor | null>(initialCursor)
  const hasMoreRef = React.useRef(initialCursor !== null)
  const isLoadingMoreRef = React.useRef(false)
  // IDs of VIP/Premium already loaded — used to deduplicate paginated standard results
  const premiumIdsRef = React.useRef<Set<string>>(new Set(initialPremium.map(p => p.id)))
  // The server already rendered the unfiltered first page — only refetch when the
  // city filter actually changes after mount, not on the initial render.
  const isFirstRenderRef = React.useRef(true)

  React.useEffect(() => {
    setShowMap(window.innerWidth < 1280)
  }, [])

  React.useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      return
    }

    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError('')
      setHasMore(false)
      lastDocRef.current = null
      hasMoreRef.current = false
      premiumIdsRef.current = new Set()

      const { premium, standard } = await refreshPropertiesAction(filters.city || undefined)
      if (cancelled) return

      premiumIdsRef.current = new Set(premium.map(p => p.id))
      setProperties([...premium, ...standard.properties])
      lastDocRef.current = standard.cursor
      hasMoreRef.current = standard.cursor !== null
      setHasMore(standard.cursor !== null)
      setIsLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [filters.city])

  const loadMore = React.useCallback(async () => {
    if (isLoadingMoreRef.current || !hasMoreRef.current || !lastDocRef.current) return

    isLoadingMoreRef.current = true
    setIsLoadingMore(true)

    const result = await loadMorePropertiesAction(
      lastDocRef.current,
      filters.city || undefined,
      Array.from(premiumIdsRef.current)
    )

    setProperties(prev => [...prev, ...result.properties])
    lastDocRef.current = result.cursor
    hasMoreRef.current = result.cursor !== null
    setHasMore(result.cursor !== null)
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
    <>
      <section className="hero">
        <OptimizedImage
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
            {/* Единственный h1 страницы. До него главная жила вообще без
                заголовка первого уровня: были только h3 карточек и h2 подвала,
                то есть самая важная страница сайта не сообщала поисковику свою
                тему ни строчкой. Слоган остался, но ниже и мельче — ключевую
                фразу несёт заголовок, а не он. */}
            <div className="hero-copy">
              <h1 className="hero-headline">{t.hero.headline}</h1>
              <p className="hero-tagline">{t.hero.tagline}</p>
            </div>
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
            <OptimizedImage
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

            {isLoading && <div className="data-refresh-indicator"><InlineSpinner label={t.messages.loading} />{t.messages.loading}</div>}

            {error && (
              <div className="no-results">
                <p>{error}</p>
              </div>
            )}

            {filteredProperties.length > 0 ? (
              <div className={`premium-results-shell data-region ${showMap ? 'with-map' : ''}`} aria-busy={isLoading}>
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
                  {isLoadingMore && <CardsSkeleton count={2} />}
                </div>

                {showMap && (
                  <aside className="premium-results-map">
                    <React.Suspense fallback={<div className="pp-map-loading" />}>
                      <PropertyMap properties={filteredProperties} />
                    </React.Suspense>
                  </aside>
                )}
              </div>
            ) : isLoading ? (
              <CardsSkeleton count={6} />
            ) : !error ? (
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
            <OptimizedImage
              src="/ads/banner.jpg"
              width={160}
              height={600}
              alt="Reklam"
              style={{ display: 'block', borderRadius: '14px' }}
            />
          </aside>
        </div>
      </section>
    </>
  )
}
