import React from 'react'
import { Link } from 'react-router-dom'
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
  hasPool: null
}

const featureChips = [
  'Hovuz',
  'Kondisioner',
  'Sauna',
  'PlayStation',
  'Bilyard',
  'Tennis',
  'Usaq zonasi',
  'Samovar',
  'Manqal',
  'Bag',
  'Deniz menzeresi',
  'Dag menzeresi'
]

const listingPlans = [
  {
    id: 'free',
    title: 'Pulsuz',
    price: '0 AZN',
    period: '/ ay',
    perks: ['3-4 foto', 'Qisa tesvir', 'Lokasiya yoxdur'],
    emphasis: 'Yeni baslayanlar ucun'
  },
  {
    id: 'standard',
    title: 'Standart',
    price: '15 AZN',
    period: '/ ay',
    perks: ['20 foto', 'Tam tesvir', 'Lokasiya elave edilir'],
    emphasis: 'Planli satis ucun optimal'
  },
  {
    id: 'premium',
    title: 'Premium',
    price: '30 AZN',
    period: '/ ay',
    perks: ['Standart paket +', '3 hefte ana sehifede one cixir', 'Son hefte normal axina kecir'],
    emphasis: 'Maksimum gorunurluk',
    highlighted: true
  }
]

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

  const mapLabel = showMap
    ? (language === 'en' ? 'Hide map' : language === 'ru' ? 'Скрыть карту' : 'Xeriteni gizlet')
    : (language === 'en' ? 'Show map' : language === 'ru' ? 'Показать карту' : 'Xeritede goster')

  return (
    <Layout>
      <section className="hero">
        <div className="hero-overlay"></div>
        <div className="hero-pattern"></div>
        <div className="container hero-content">
          <p className="hero-kicker">Birklik.az</p>
          <h1 className="hero-title">Her sey bir klikle hazir</h1>
          <p className="hero-subtitle">{t.hero.subtitle}</p>
          <SearchBar
            value={filters.search}
            onChange={(value) => setFilters({ ...filters, search: value })}
          />

          <div className="hero-chips">
            {featureChips.map((chip) => (
              <span className="hero-chip" key={chip}>{chip}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="section properties-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Top villalar ve istirahet evleri</h2>
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

      <section className="section plans-section">
        <div className="container">
          <div className="plans-header">
            <h2 className="section-title">3 nov elan paketi</h2>
            <p>Menim de fikrimce sizin teklif etdiyiniz 3 paket duzgun ve bazar ucun balanslidir.</p>
          </div>

          <div className="plans-grid">
            {listingPlans.map((plan) => (
              <article key={plan.id} className={`plan-card ${plan.highlighted ? 'plan-card-highlighted' : ''}`}>
                <h3>{plan.title}</h3>
                <div className="plan-price">
                  <strong>{plan.price}</strong>
                  <span>{plan.period}</span>
                </div>
                <p className="plan-emphasis">{plan.emphasis}</p>
                <ul>
                  {plan.perks.map((perk) => (
                    <li key={perk}>{perk}</li>
                  ))}
                </ul>
                <button className={`btn ${plan.highlighted ? 'btn-accent' : 'btn-outline'}`}>Elan yerleshdir</button>
              </article>
            ))}
          </div>

          <p className="plans-note">
            Tövsiyem: startda bu qiymetleri saxlayin, 4-6 hefte sonra conversion ve demand datasina gore Standarti 20 AZN, Premiumu 50 AZN edin.
          </p>
        </div>
      </section>

      <section className="section cta-section">
        <div className="container cta-box">
          <h2>Her sey bir klikle hazir</h2>
          <p>Evini bugun elan et, sabahdan rezervasiya qebul etmeye basla.</p>
          <Link className="btn btn-accent btn-lg" to="/dashboard/add">Indi basla</Link>
        </div>
      </section>
    </Layout>
  )
}
