import React from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../context'
import { useAuth } from '../context'
import { Property } from '../types'
import { Loading } from './Loading'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../config/firebase'
import './TabsStyle.css'

export const BookmarkedTab: React.FC = () => {
  const { language } = useLanguage()
  const { user } = useAuth()
  const [bookmarkedProperties, setBookmarkedProperties] = React.useState<Property[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    const loadBookmarkedProperties = async () => {
      if (!user?.id) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        // Query all properties where favorites array includes user.id
        const propertiesRef = collection(db, 'properties')
        const q = query(
          propertiesRef,
          where('favorites', 'array-contains', user.id)
        )
        const snapshot = await getDocs(q)
        const properties = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id
        })) as Property[]

        setBookmarkedProperties(properties)
      } catch (error) {
        console.error('Error loading bookmarked properties:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadBookmarkedProperties()
  }, [user?.id])

  if (isLoading) {
    return <Loading />
  }

  return (
    <div className="tab-content fade-in">
      <h2 className="tab-title">
        {language === 'en'
          ? 'Bookmarked Properties'
          : language === 'ru'
            ? 'Сохраненные объекты'
            : 'Əlamətlənmiş Mülk'}
      </h2>

      {bookmarkedProperties.length === 0 ? (
        <div className="empty-state">
          <p>
            {language === 'en'
              ? 'No bookmarked properties yet'
              : language === 'ru'
                ? 'Пока нет сохраненных объектов'
                : 'Henüz əlamətlənmiş mülk yoxdur'}
          </p>
        </div>
      ) : (
        <div className="properties-list">
          {bookmarkedProperties.map((property) => (
            <Link
              key={property.id}
              to={`/property/${property.id}`}
              className="property-preview-item"
            >
              <div className="preview-image">
                {property.images && property.images.length > 0 && (
                  <img src={property.images[0]} alt={property.title?.az || property.title?.en || ''} />
                )}
              </div>
              <div className="preview-info">
                <h3 className="preview-title">
                  {language === 'en' ? property.title?.en : language === 'ru' ? property.title?.ru : property.title?.az}
                </h3>
                <p className="preview-location">
                  {language === 'en' ? property.address?.en : language === 'ru' ? property.address?.ru : property.address?.az}
                </p>
                <p className="preview-price">
                  {property.price?.daily} AZN / {language === 'en' ? 'night' : language === 'ru' ? 'ночь' : 'gün'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
