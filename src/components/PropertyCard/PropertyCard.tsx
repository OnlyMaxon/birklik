import React from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../context'
import { useAuth } from '../../context'
import { toggleFavorite, isPropertyFavorited } from '../../services/favoritesService'
import { Property, Language } from '../../types'
import './PropertyCard.css'
import * as logger from '../../services/logger'

interface PropertyCardProps {
  property: Property
  checkIn?: string
  checkOut?: string
  onFavoriteToggle?: (propertyId: string, isFavorited: boolean) => void
}

export const PropertyCard: React.FC<PropertyCardProps> = ({ 
  property, 
  checkIn, 
  checkOut,
  onFavoriteToggle
}) => {
  const { language, t } = useLanguage()
  const { user, isAuthenticated } = useAuth()
  const [isFavoriting, setIsFavoriting] = React.useState(false)
  const [isFavorited, setIsFavorited] = React.useState(
    isPropertyFavorited(property.favorites, user?.id ?? '')
  )

  const getLocalizedText = (text: Partial<Record<Language, string>>) => text[language] || text.az || text.en || ''

  const calculateNights = () => {
    if (!checkIn || !checkOut) return 0
    const checkInDate = new Date(checkIn)
    const checkOutDate = new Date(checkOut)
    const diff = checkOutDate.getTime() - checkInDate.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    
    if (!isAuthenticated || !user) {
      alert(language === 'en' ? 'Please sign in to add favorites' : language === 'ru' ? 'Пожалуйста, войдите чтобы добавить в избранные' : 'Lütfen favorilere eklemek için giriş yapın')
      return
    }

    setIsFavoriting(true)
    try {
      await toggleFavorite(property.id, user.id, isFavorited)
      setIsFavorited(!isFavorited)
      onFavoriteToggle?.(property.id, !isFavorited)
    } catch (error) {
      logger.error('Error toggling favorite:', error)
      alert(language === 'en' ? 'Error updating favorites' : language === 'ru' ? 'Ошибка при обновлении избранных' : 'Favori güncellenirken hata oluştu')
    } finally {
      setIsFavoriting(false)
    }
  }

  const nights = calculateNights()
  const totalPrice = nights > 0 ? property.price.daily * nights : property.price.daily

  // Check if premium is still active
  const isPremium = property.premiumExpiresAt ? new Date(property.premiumExpiresAt).getTime() > Date.now() : false

  return (
    <div className="property-card card">
      <Link to={`/property/${property.id}`} className="property-image">
        <img src={property.images?.[0] || 'https://via.placeholder.com/400x300?text=No+Image'} alt={getLocalizedText(property.title)} loading="lazy" />
        <div className="property-badges">
          <div className="property-type-badge badge badge-primary">
            {t.propertyTypes[property.type]}
          </div>
          {isPremium && (
            <div className="property-premium-badge badge badge-premium" title={language === 'en' ? 'Premium listing' : language === 'ru' ? 'Премиум объявление' : 'Premium elan'}>
              <span>⭐</span> Premium
            </div>
          )}
          {property.amenities?.includes('pool') && (
            <div className="property-pool-badge badge badge-accent">
              💧 {t.amenities.pool}
            </div>
          )}
        </div>
      </Link>
      
      <button
        onClick={handleFavoriteClick}
        disabled={isFavoriting}
        className={`property-favorite-btn ${isFavorited ? 'favorited' : ''}`}
        title={!isAuthenticated ? (language === 'en' ? 'Sign in to favorite' : language === 'ru' ? 'Войдите чтобы добавить в избранные' : 'Favorilere eklemek için giriş yapın') : ''}
        aria-label="Add to favorites"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </button>
      
      <div className="property-content">
        <Link to={`/property/${property.id}`} className="property-title-link">
          <h3 className="property-title">{getLocalizedText(property.title)}</h3>
        </Link>
        
        <p className="property-location">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          {t.districts[property.district] || property.district}
        </p>

        <div className="property-features">
          <span className="feature">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            {property.rooms}
          </span>
          {property.minGuests || property.maxGuests ? (
            <span className="feature" title={language === 'en' ? 'Guests' : language === 'ru' ? 'Гости' : 'Qonaqlar'}>
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              {property.minGuests && property.maxGuests 
                ? `${property.minGuests}-${property.maxGuests}`
                : property.maxGuests || property.minGuests
              }
            </span>
          ) : null}
          <span className="feature">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            </svg>
            {property.area}m²
          </span>
          {property.views !== undefined && (
            <span className="feature views-count" title={language === 'en' ? 'Views' : language === 'ru' ? 'Просмотры' : 'Baxışlar'}>
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              {property.views}
            </span>
          )}
          {property.likes && property.likes.length > 0 && (
            <span className="feature likes-count" title={language === 'en' ? 'Likes' : language === 'ru' ? 'Нравится' : 'Bəyən'}>
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              {property.likes.length}
            </span>
          )}
        </div>

        <div className="property-footer">
          <div className="property-price">
            {nights > 0 && (
              <div className="price-info">
                <div className="price-nights">
                  {nights} {language === 'en' ? 'night' : language === 'ru' ? 'ночь' : 'gecə'}{nights !== 1 ? 's' : ''}
                </div>
                <div className="price-breakdown">
                  <span className="price-per-night">{property.price.daily} {property.price.currency}/{t.property.perNight}</span>
                  <span className="price-total">{totalPrice} {property.price.currency}</span>
                </div>
              </div>
            )}
            {nights === 0 && (
              <>
                <span className="price-value">{property.price.daily} {property.price.currency}</span>
                <span className="price-period">/{t.property.perNight}</span>
              </>
            )}
          </div>
          
          {property.rating && (
            <div className="property-rating rating">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <span>{property.rating}</span>
              <span className="reviews-count">({property.reviews})</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
