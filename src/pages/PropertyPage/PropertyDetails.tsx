import React from 'react'
import { Property, Language } from '../../types'

interface PropertyDetailsProps {
  property: Property
  language: Language
}

/**
 * PropertyDetails Component - Displays description, amenities, rooms, and property details
 * @component
 * @param {PropertyDetailsProps} props - Component props
 * @returns {React.ReactElement} Rendered details section
 * @example
 * <PropertyDetails property={property} language="en" />
 */
export const PropertyDetails: React.FC<PropertyDetailsProps> = ({ property, language }) => {
  const getLocalizedText = (text: Partial<Record<Language, string>>) =>
    text[language] || text.az || text.en || ''

  const amenitiesLabel = language === 'en' ? 'Amenities' : language === 'ru' ? 'Удобства' : 'Xidmətlər'
  const roomsLabel = language === 'en' ? 'Rooms' : language === 'ru' ? 'Комнаты' : 'Otaqlar'
  const guestsLabel = language === 'en' ? 'Guests' : language === 'ru' ? 'Гости' : 'Qonaqlar'
  const typeLabel = language === 'en' ? 'Type' : language === 'ru' ? 'Тип' : 'Tip'
  const districtLabel = language === 'en' ? 'District' : language === 'ru' ? 'Район' : 'Rayon'

  return (
    <div style={{ marginBottom: '2rem' }}>
      {/* Description */}
      {property.description && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            {language === 'en' ? 'Description' : language === 'ru' ? 'Описание' : 'Açıqlama'}
          </h2>
          <p style={{ lineHeight: '1.6', color: '#333', whiteSpace: 'pre-wrap' }}>
            {getLocalizedText(property.description)}
          </p>
        </div>
      )}

      {/* Quick Info Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}
      >
        {property.rooms && (
          <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 0.5rem 0', color: '#666', fontSize: '0.9rem' }}>{roomsLabel}</p>
            <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 600 }}>{property.rooms}</p>
          </div>
        )}
        {property.maxGuests && (
          <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 0.5rem 0', color: '#666', fontSize: '0.9rem' }}>{guestsLabel}</p>
            <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 600 }}>{property.maxGuests}</p>
          </div>
        )}
        {property.type && (
          <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 0.5rem 0', color: '#666', fontSize: '0.9rem' }}>{typeLabel}</p>
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{property.type.charAt(0).toUpperCase() + property.type.slice(1)}</p>
          </div>
        )}
        {property.district && (
          <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 0.5rem 0', color: '#666', fontSize: '0.9rem' }}>{districtLabel}</p>
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{property.district}</p>
          </div>
        )}
      </div>

      {/* Amenities List */}
      {property.amenities && property.amenities.length > 0 && (
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '1rem' }}>{amenitiesLabel}</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '0.75rem'
            }}
          >
            {property.amenities.map((amenity, idx) => (
              <div
                key={idx}
                style={{
                  padding: '0.75rem',
                  background: '#e8f5e9',
                  borderRadius: '6px',
                  fontSize: '0.95rem'
                }}
              >
                ✓ {amenity.charAt(0).toUpperCase() + amenity.slice(1)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
