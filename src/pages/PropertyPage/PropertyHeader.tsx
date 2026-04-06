import React from 'react'
import { useAuth } from '../../context'
import { Property, Language } from '../../types'
import { toggleLikeProperty } from '../../services'

interface PropertyHeaderProps {
  property: Property
  language: Language
  onLikeToggle?: () => void
}

/**
 * PropertyHeader Component - Displays property title, price, favorite button, and owner info
 * @component
 * @param {PropertyHeaderProps} props - Component props
 * @returns {React.ReactElement} Rendered header section
 * @example
 * <PropertyHeader property={property} language="en" onLikeToggle={refresh} />
 */
export const PropertyHeader: React.FC<PropertyHeaderProps> = ({ property, language, onLikeToggle }) => {
  const { isAuthenticated, user } = useAuth()
  const [isFavorited, setIsFavorited] = React.useState(false)
  const [isLiking, setIsLiking] = React.useState(false)

  React.useEffect(() => {
    const checkFavorited = async () => {
      if (isAuthenticated && user && property?.favorites) {
        setIsFavorited(property.favorites.includes(user.id))
      }
    }
    checkFavorited()
  }, [isAuthenticated, user, property?.favorites])

  const getLocalizedText = (text: Partial<Record<Language, string>>) =>
    text[language] || text.az || text.en || ''

  const handleToggleLike = async () => {
    if (!isAuthenticated || !user) return

    setIsLiking(true)
    try {
      await toggleLikeProperty(property.id, user.id)
      setIsFavorited(!isFavorited)
      onLikeToggle?.()
    } catch (error) {
      console.error('Error toggling favorite:', error)
    } finally {
      setIsLiking(false)
    }
  }

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', fontWeight: 600 }}>
            {getLocalizedText(property.title)}
          </h1>
          <p style={{ margin: '0', color: '#666', fontSize: '0.95rem' }}>
            {getLocalizedText(property.address)}
          </p>
        </div>
        <button
          onClick={handleToggleLike}
          disabled={!isAuthenticated || isLiking}
          style={{
            padding: '0.5rem 1rem',
            border: `2px solid ${isFavorited ? '#e74c3c' : '#bdc3c7'}`,
            background: isFavorited ? '#ffeaea' : 'white',
            borderRadius: '8px',
            cursor: isAuthenticated ? 'pointer' : 'not-allowed',
            fontSize: '0.9rem',
            fontWeight: 500,
            color: isFavorited ? '#e74c3c' : '#333',
            transition: 'all 0.3s ease'
          }}
        >
          {isFavorited ? '❤️ ' : '🤍 '} {isFavorited ? 'Favorited' : 'Add to Favorites'}
        </button>
      </div>

      {/* Price */}
      {property.price && (
        <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#27ae60', marginBottom: '1rem' }}>
          ${property.price.daily} <span style={{ fontSize: '0.9rem', color: '#666', fontWeight: 400 }}>/ {language === 'en' ? 'night' : language === 'ru' ? 'ночь' : 'gecə'}</span>
        </div>
      )}

      {/* Owner Info */}
      {property.owner && (
        <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
          <p style={{ margin: '0 0 0.5rem 0', color: '#666', fontSize: '0.9rem' }}>
            {language === 'en' ? 'Hosted by' : language === 'ru' ? 'Размещено' : 'Evin sahibi'}
          </p>
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 500 }}>{property.owner.name}</p>
          {property.owner.phone && (
            <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>{property.owner.phone}</p>
          )}
        </div>
      )}
    </div>
  )
}
