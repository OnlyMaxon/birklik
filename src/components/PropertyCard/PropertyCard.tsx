import React from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../context'
import { Property, LocalizedText } from '../../types'
import './PropertyCard.css'

interface PropertyCardProps {
  property: Property
}

export const PropertyCard: React.FC<PropertyCardProps> = ({ property }) => {
  const { language, t } = useLanguage()

  const getLocalizedText = (text: LocalizedText) => text[language] || text.az || text.en || ''

  return (
    <Link to={`/property/${property.id}`} className="property-card card">
      <div className="property-image">
        <img src={property.images[0]} alt={getLocalizedText(property.title)} loading="lazy" />
        <div className="property-type-badge badge badge-primary">
          {t.propertyTypes[property.type]}
        </div>
        {property.amenities.includes('pool') && (
          <div className="property-pool-badge badge badge-accent">
            {t.amenities.pool}
          </div>
        )}
      </div>
      
      <div className="property-content">
        <h3 className="property-title">{getLocalizedText(property.title)}</h3>
        
        <p className="property-location">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          {t.districts[property.district]}
        </p>

        <div className="property-features">
          <span className="feature">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            {property.rooms} {t.property.rooms}
          </span>
          <span className="feature">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            </svg>
            {property.area} {t.property.sqm}
          </span>
        </div>

        <div className="property-footer">
          <div className="property-price">
            <span className="price-value">{property.price.daily} {property.price.currency}</span>
            <span className="price-period">/{t.property.perNight}</span>
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
    </Link>
  )
}
