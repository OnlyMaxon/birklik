import React from 'react'
import { useLanguage, useAuth } from '../../context'
import { PropertyCard } from '../../components'
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

        // Query all properties where favorites array includes user.id
        const propertiesRef = collection(db, 'properties')
        const q = query(
          propertiesRef,
          where('favorites', 'array-contains', user.id)
        )
        const snapshot = await getDocs(q)
        const favoritedProperties = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id
        })) as Property[]

        setFavorites(favoritedProperties)
      } catch (err) {
        logger.error('Error loading favorites:', err)
        setError(
          language === 'en'
            ? 'Error loading favorites'
            : language === 'ru'
              ? 'Ошибка при загрузке избранных'
              : 'Favorilər yüklənərkən xəta'
        )
      } finally {
        setIsLoading(false)
      }
    }

    loadFavorites()
  }, [user?.id, language])

  const handleFavoriteToggle = (propertyId: string) => {
    // Remove from favorites when user clicks heart
    setFavorites((prev) => prev.filter((p) => p.id !== propertyId))
  }

  return (
    <div className="tab-content fade-in">
      <h2>
        {language === 'en'
          ? 'Favorites'
          : language === 'ru'
            ? 'Избранные'
            : 'Sevimlilər'}
      </h2>

      {error && <div className="error-message">{error}</div>}

      {isLoading ? (
        <div className="loading-spinner">
          <p>
            {language === 'en'
              ? 'Loading...'
              : language === 'ru'
                ? 'Загрузка...'
                : 'Yüklənir...'}
          </p>
        </div>
      ) : favorites.length === 0 ? (
        <div className="empty-state">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: '#d4a574', opacity: 0.5, marginBottom: '1rem' }}
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <p style={{ color: '#9b7448', fontSize: '0.95rem' }}>
            {language === 'en'
              ? 'No favorites yet'
              : language === 'ru'
                ? 'Пока нет избранных'
                : 'Hələ sevimlilər yoxdur'}
          </p>
          <p style={{ color: '#b8976f', fontSize: '0.85rem' }}>
            {language === 'en'
              ? 'Click the heart icon on properties to add them here'
              : language === 'ru'
                ? 'Нажимайте на сердечко рядом с прпиями чтобы добавить их сюда'
                : 'Onları buraya əlavə etmək üçün mülk sevinç düyməsinə klikləyin'}
          </p>
        </div>
      ) : (
        <div className="properties-grid">
          {favorites.map((property) => (
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
