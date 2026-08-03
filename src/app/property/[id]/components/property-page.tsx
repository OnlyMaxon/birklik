import {getAppTranslations} from '@/lib/i18n/get-app-translations'
import {Link} from '@/lib/navigation'
import {PropertyCard} from '@/components'
import {ImageGallery} from './image-gallery'
import {FavoriteButton} from './favorite-button'
import {ShareButton} from './share-button'
import {OwnerActions} from './owner-actions'
import {BookingCalendar} from './booking-calendar'
import {RatingWidget} from './rating-widget'
import {CommentsSection} from './comments-section'
import {PropertyMapSection} from './property-map-section'
import {moreFilterOptions, nearFilterOptions, cityLocationOptions, getOptionLabel, cities} from '@/data'
import {isPremiumActive} from '@/utils/premium-helper'
import type {Booking, Language, Property} from '@/types'

interface PropertyPageProps {
  property: Property
  bookings: Booking[]
  similarProperties: Property[]
  isAuthenticated: boolean
  isOwner: boolean
  isFavorited: boolean
  hasBooked: boolean
  userRating: number | null
  currentUserId: string | null
}

export async function PropertyPage({
  property,
  bookings,
  similarProperties,
  isAuthenticated,
  isOwner,
  isFavorited,
  hasBooked,
  userRating,
  currentUserId
}: PropertyPageProps) {
  const {language, t} = await getAppTranslations()

  const getLocalizedText = (text: Partial<Record<Language, string>>) => text[language] || text.az || text.en || ''

  const currencySymbol = (code: string) => (code === 'AZN' ? '₼' : code)

  const formatDate = (value?: string) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : language === 'ru' ? 'ru-RU' : 'az-Latn-AZ').format(date)
  }

  const cityLabel = (() => {
    if (property.city) {
      const cityObj = cities.find(c => c.value === property.city)
      if (cityObj) return language === 'en' ? cityObj.en : language === 'ru' ? (cityObj.ru || cityObj.az) : cityObj.az
      return property.city
    }
    return t.districts[property.district] || ''
  })()

  const moreLabels = (property.extraFeatures || []).map(key => getOptionLabel(moreFilterOptions, key, t))
  const nearLabels = (property.nearbyPlaces || []).map(key => getOptionLabel(nearFilterOptions, key, t))
  const selectedLocationOptions = property.locationCategory ? cityLocationOptions[property.locationCategory] : null
  const locationLabels = selectedLocationOptions
    ? (property.locationTags || []).map(key => getOptionLabel(selectedLocationOptions, key, t))
    : []

  return (
    <>
      <div className="property-page">
        <div className="container">
          <nav className="breadcrumb">
            <Link to="/">{t.nav.home}</Link>
            <span>/</span>
            <span>{cityLabel}</span>
            <span>/</span>
            <span>{getLocalizedText(property.title)}</span>
            <span className="pp-property-id">#{property.id}</span>
          </nav>

          <div className="property-layout">
            <div className="property-main">
              <ImageGallery images={property.images} alt={getLocalizedText(property.title)} />

              <div className="pp-title-card">
                <div className="pp-title-card__badges">
                  <span className="badge badge-primary">{t.propertyTypes[property.type]}</span>
                  {property.listingTier === 'vip' && <span className="badge badge-vip">VIP</span>}
                  {isPremiumActive(property.premiumExpiresAt) && <span className="badge badge-premium">Premium</span>}
                </div>
                <div className="pp-title-card__top">
                  <h1 className="pp-page-title">{getLocalizedText(property.title)}</h1>
                  <div className="pp-header-actions">
                    <FavoriteButton propertyId={property.id} initialIsFavorited={isFavorited} isAuthenticated={isAuthenticated} />
                    <ShareButton propertyId={property.id} title={property.title} />
                  </div>
                </div>
                <div className="pp-title-card__meta">
                  <span className="location">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    {cityLabel}
                  </span>
                  {property.rating && (
                    <span className="rating">
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                      {property.rating} ({property.reviews})
                    </span>
                  )}
                  {property.views && (
                    <span className="views-badge">
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                      {property.views} {t.property.views}
                    </span>
                  )}
                  {property.likes && property.likes.length > 0 && (
                    <span className="likes-badge">
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                      {property.likes.length}
                    </span>
                  )}
                  {property.createdAt && (
                    <span className="pp-published-badge">
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      {t.property.publishedOn}: {formatDate(property.createdAt)}
                    </span>
                  )}
                </div>
                {isOwner && <OwnerActions propertyId={property.id} listingTier={property.listingTier} />}
              </div>

              <div className="pp-details-bar">
                <div className="pp-detail-item">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  <span className="pp-detail-value">{property.rooms}</span>
                  <span className="pp-detail-label">{t.property.rooms}</span>
                </div>
                <div className="pp-detail-item">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  </svg>
                  <span className="pp-detail-value">{property.area}</span>
                  <span className="pp-detail-label">{t.property.sqm}</span>
                </div>
                {(property.maxGuests || property.minGuests) && (
                  <div className="pp-detail-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    <span className="pp-detail-value">
                      {property.minGuests && property.maxGuests ? `${property.minGuests}–${property.maxGuests}` : property.maxGuests || property.minGuests}
                    </span>
                    <span className="pp-detail-label">{language === 'en' ? 'Guests' : language === 'ru' ? 'Гости' : 'Qonaqlar'}</span>
                  </div>
                )}
                <div className="pp-detail-item pp-detail-item--price">
                  <span className="pp-detail-currency-icon">₼</span>
                  <span className="pp-detail-price">{property.price.daily} {currencySymbol(property.price.currency)}</span>
                  <span className="pp-detail-label">/{t.property.perNight}</span>
                </div>
              </div>

              {getLocalizedText(property.description) && (
                <div className="pp-section">
                  <div className="pp-section-header">
                    <div className="pp-section-icon pp-section-icon--blue">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                      </svg>
                    </div>
                    <h3 className="pp-section-title">{t.property.description}</h3>
                  </div>
                  <div className="pp-section-body">
                    <p>{getLocalizedText(property.description)}</p>
                  </div>
                </div>
              )}

              {property.amenities && property.amenities.length > 0 && (
                <div className="pp-section">
                  <div className="pp-section-header">
                    <div className="pp-section-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                      </svg>
                    </div>
                    <h3 className="pp-section-title">{t.property.amenities}</h3>
                  </div>
                  <div className="pp-section-body">
                    <div className="pp-chips-wrap">
                      {property.amenities.map(amenity => (
                        <span key={amenity} className="pp-amenity-chip">
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          {t?.amenities?.[amenity] || amenity}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {moreLabels.length > 0 && (
                <div className="pp-section">
                  <div className="pp-section-header">
                    <div className="pp-section-icon pp-section-icon--purple">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                      </svg>
                    </div>
                    <h3 className="pp-section-title">{t.property.more}</h3>
                  </div>
                  <div className="pp-section-body">
                    <div className="pp-chips-wrap">
                      {moreLabels.map(label => <span key={label} className="pp-extra-chip">{label}</span>)}
                    </div>
                  </div>
                </div>
              )}

              {nearLabels.length > 0 && (
                <div className="pp-section">
                  <div className="pp-section-header">
                    <div className="pp-section-icon pp-section-icon--amber">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                      </svg>
                    </div>
                    <h3 className="pp-section-title">{t.property.near}</h3>
                  </div>
                  <div className="pp-section-body">
                    <div className="pp-chips-wrap">
                      {nearLabels.map(label => <span key={label} className="pp-near-chip">{label}</span>)}
                    </div>
                  </div>
                </div>
              )}

              <div className="pp-section">
                <div className="pp-section-header">
                  <div className="pp-section-icon pp-section-icon--purple">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                  </div>
                  <h3 className="pp-section-title">{t.property.address}</h3>
                </div>
                <div className="pp-section-body">
                  <p className="pp-address-text">{getLocalizedText(property.address)}</p>
                  {property.city && (
                    <p className="pp-city-line"><strong>{t.property.city}:</strong> {property.city}</p>
                  )}
                  {locationLabels.length > 0 && (
                    <div className="pp-chips-wrap" style={{marginBottom: '0.75rem'}}>
                      {locationLabels.map(label => <span key={label} className="location-tag-chip">{label}</span>)}
                    </div>
                  )}
                  <PropertyMapSection property={property} />
                </div>
              </div>
            </div>

            <div className="property-sidebar">
              <div className="pp-price-card">
                <div className="pp-price-display">
                  <span className="pp-price-big">{property.price.daily}</span>
                  <span className="pp-price-cur">{currencySymbol(property.price.currency)}</span>
                  <span className="pp-price-per">/{t.property.perNight}</span>
                </div>
                {property.rating && (
                  <div className="pp-price-rating">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    {property.rating} ({property.reviews})
                  </div>
                )}
              </div>

              <div className="booking-card card">
                <div className="owner-info owner-info-priority">
                  <h4>{t.property.contact}</h4>
                  <p className="owner-name">{property.owner.name}</p>
                  <a href={`tel:${property.owner.phone}`} className="owner-phone">
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    {property.owner.phone}
                  </a>
                </div>

                <BookingCalendar
                  propertyId={property.id}
                  dailyPrice={property.price.daily}
                  currency={property.price.currency}
                  isActive={property.isActive}
                  unavailableFrom={property.unavailableFrom}
                  unavailableTo={property.unavailableTo}
                  bookings={bookings}
                  isAuthenticated={isAuthenticated}
                  initialHasBooked={hasBooked}
                />
              </div>

              <div className="property-interactions-section">
                <RatingWidget
                  propertyId={property.id}
                  averageRating={property.rating}
                  reviewCount={property.reviews}
                  initialUserRating={userRating}
                  hasBooked={hasBooked}
                  isAuthenticated={isAuthenticated}
                />
                <CommentsSection
                  propertyId={property.id}
                  initialComments={property.comments || []}
                  currentUserId={currentUserId}
                  isAuthenticated={isAuthenticated}
                />
              </div>
            </div>
          </div>

          {similarProperties.length > 0 && (
            <div className="pp-similar-section">
              <h3 className="pp-similar-title">{t.property.similarListings}</h3>
              <div className="pp-similar-scroll">
                {similarProperties.map(p => (
                  <div key={p.id} className="pp-similar-card-wrap">
                    <PropertyCard property={p} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
