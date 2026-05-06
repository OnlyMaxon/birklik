import React from 'react'
import { useLanguage, useAuth } from '../../context'
import { PropertyCard, Loading } from '../../components'
import { Property } from '../../types'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../config/firebase'
import * as logger from '../../services/logger'

export const FavoritesTab: React.FC = () => {
  const { language } = useLanguage()
  const { user } = useAuth()
  const [favorites, setFavorites] = React.useState<Property[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (!user?.id) return

    const loadFavorites = async () => {
      try {
        setIsLoading(true)
        setError('')
        const q = query(
          collection(db, 'properties'),
          where('favorites', 'array-contains', user.id)
        )
        const snapshot = await getDocs(q)
        setFavorites(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Property))
      } catch (err) {
        logger.error('Error loading favorites:', err)
        setError(
          language === 'en' ? 'Error loading favorites'
          : language === 'ru' ? 'Ошибка при загрузке избранных'
          : 'Favorilər yüklənərkən xəta'
        )
      } finally {
        setIsLoading(false)
      }
    }

    loadFavorites()
  }, [user?.id, language])

  const handleFavoriteToggle = (propertyId: string) => {
    setFavorites(prev => prev.filter(p => p.id !== propertyId))
  }

  const title = language === 'en' ? 'Favorites' : language === 'ru' ? 'Избранные' : 'Sevimlilər'

  return (
    <div className="tab-content fade-in">

      {/* Header */}
      <div className="ntf-header">
        <h3 className="ntf-header-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#f43f5e' }}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          {title}
          {!isLoading && favorites.length > 0 && (
            <span className="ntf-unread-badge">{favorites.length}</span>
          )}
        </h3>
      </div>

      {/* Error */}
      {error && <div className="error-message">{error}</div>}

      {/* Loading */}
      {isLoading ? (
        <Loading />
      ) : favorites.length === 0 ? (

        /* Empty state */
        <div className="ntf-empty">
          <div className="ntf-empty-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </div>
          <p className="ntf-empty-text">
            {language === 'en' ? 'No favorites yet'
             : language === 'ru' ? 'Пока нет избранных'
             : 'Hələ sevimlilər yoxdur'}
          </p>
          <p className="ntf-empty-text" style={{ fontSize: '0.8rem' }}>
            {language === 'en' ? 'Click the heart icon on a property to save it here'
             : language === 'ru' ? 'Нажмите на сердечко у объявления, чтобы сохранить его'
             : 'Saxlamaq üçün elanın üzərindəki ürək ikonuna basın'}
          </p>
        </div>

      ) : (

        /* Grid */
        <div className="properties-grid">
          {favorites.map(property => (
            <PropertyCard
              key={property.id}
              property={property}
              onFavoriteToggle={handleFavoriteToggle}
            />
          ))}
        </div>

      )}
    </div>
  )
}
