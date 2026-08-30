import {PropertyCardSkeleton} from '@/components/property-card'

function Lines({count = 3}: {count?: number}) {
  return <>{Array.from({length: count}, (_, index) => <div key={index} className="skeleton-line skeleton-shimmer" />)}</>
}

export function InlineSpinner({label = 'Loading'}: {label?: string}) {
  return <span className="inline-spinner" role="status" aria-label={label} />
}

export function AuthSkeleton() {
  return <div className="auth-page" aria-busy="true" aria-label="Loading"><div className="auth-container"><div className="auth-card card skeleton-panel"><div className="skeleton-heading skeleton-shimmer" /><Lines count={2} /><div className="skeleton-field skeleton-shimmer" /><div className="skeleton-field skeleton-shimmer" /><div className="skeleton-button skeleton-shimmer" /></div></div></div>
}

export function ContentPageSkeleton() {
  return <div className="content-page-skeleton" aria-busy="true" aria-label="Loading"><div className="content-page-skeleton__hero"><div className="skeleton-heading skeleton-shimmer" /></div><div className="content-page-skeleton__body card"><Lines count={3} /><div className="skeleton-section skeleton-shimmer" /><Lines count={4} /></div></div>
}

export function DashboardSkeleton() {
  return <div className="dashboard-page" aria-busy="true" aria-label="Loading dashboard"><div className="container"><div className="dashboard-header skeleton-dashboard-header"><div className="skeleton-avatar skeleton-shimmer" /><div><div className="skeleton-heading skeleton-shimmer" /><div className="skeleton-line skeleton-shimmer" /></div></div><div className="dashboard-layout"><aside className="dashboard-sidebar skeleton-sidebar"><Lines count={6} /></aside><main className="dashboard-content"><div className="tab-content"><div className="skeleton-heading skeleton-shimmer" /><ListingRowsSkeleton /></div></main></div></div></div>
}

export function ListingRowsSkeleton({count = 3}: {count?: number}) {
  return <div className="skeleton-list">{Array.from({length: count}, (_, index) => <div className="skeleton-list-row card" key={index}><div className="skeleton-list-image skeleton-shimmer" /><div className="skeleton-list-copy"><Lines count={3} /></div></div>)}</div>
}

export function CardsSkeleton({count = 4}: {count?: number}) {
  return <div className="properties-grid premium-properties-grid" aria-busy="true">{Array.from({length: count}, (_, index) => <PropertyCardSkeleton key={index} />)}</div>
}

export function HomePageSkeleton() {
  return (
    <div className="home-page-skeleton" aria-busy="true" aria-label="Loading properties">
      <section className="hero home-page-skeleton__hero">
        <div className="hero-bg-img skeleton-shimmer" aria-hidden="true" />
        <div className="container hero-content">
          <div className="hero-search-shell">
            {/* Две полосы, а не одна: в шапке теперь заголовок и слоган под ним.
                С одной полосой на их месте страница дёргалась при подстановке. */}
            <div className="hero-copy">
              <div className="home-page-skeleton__tagline skeleton-shimmer" />
              <div className="home-page-skeleton__subline skeleton-shimmer" />
            </div>
            <div className="search-bar-card home-page-skeleton__search">
              {Array.from({length: 3}, (_, index) => (
                <div className="search-card-field" key={index}>
                  <div className="home-page-skeleton__label skeleton-shimmer" />
                  <div className="home-page-skeleton__input skeleton-shimmer" />
                </div>
              ))}
              <div className="search-actions-row">
                <div className="home-page-skeleton__filter-button skeleton-shimmer" />
                <div className="home-page-skeleton__search-button skeleton-shimmer" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section properties-section">
        <div className="properties-content">
          <div className="ad-slot ad-slot--left home-page-skeleton__ad skeleton-shimmer" aria-hidden="true" />
          <div className="container">
            <div className="filters-container home-page-skeleton__toolbar">
              <div className="filters-top-row">
                <div className="home-page-skeleton__toolbar-button skeleton-shimmer" />
                <div className="home-page-skeleton__view-actions">
                  <div className="home-page-skeleton__icon-button skeleton-shimmer" />
                  <div className="home-page-skeleton__icon-button skeleton-shimmer" />
                </div>
              </div>
            </div>
            <CardsSkeleton count={8} />
          </div>
          <div className="ad-slot ad-slot--right home-page-skeleton__ad skeleton-shimmer" aria-hidden="true" />
        </div>
      </section>
    </div>
  )
}

export function FormPageSkeleton() {
  return <section className="skeleton-form-page" aria-busy="true" aria-label="Loading form"><div className="container"><div className="skeleton-heading skeleton-shimmer" />{Array.from({length: 4}, (_, index) => <div className="form-section skeleton-panel" key={index}><div className="skeleton-heading skeleton-shimmer" /><div className="skeleton-form-grid"><div className="skeleton-field skeleton-shimmer" /><div className="skeleton-field skeleton-shimmer" /></div></div>)}</div></section>
}

export function PropertyPageSkeleton() {
  return <div className="property-page" aria-busy="true" aria-label="Loading property"><div className="container"><div className="property-layout"><div className="property-main"><div className="gallery-main skeleton-shimmer" /><div className="card skeleton-panel"><div className="skeleton-heading skeleton-shimmer" /><Lines count={4} /></div></div><aside className="property-sidebar"><div className="card skeleton-panel"><div className="skeleton-heading skeleton-shimmer" /><div className="skeleton-section skeleton-shimmer" /></div></aside></div></div></div>
}

export function PaymentSkeleton() {
  return <main className="payment-page" aria-busy="true" aria-label="Loading payment"><div className="container payment-shell"><div className="skeleton-heading skeleton-shimmer" /><div className="skeleton-form-grid"><div className="card skeleton-panel"><Lines count={5} /></div><div className="card skeleton-panel"><Lines count={5} /></div></div></div></main>
}

export function MapSkeleton() {
  return <div className="map-skeleton skeleton-shimmer" aria-label="Loading map" />
}
