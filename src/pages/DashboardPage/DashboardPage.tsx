import React from 'react'
import { useLanguage, useAuth } from '../../context'
import { Property, PropertyType, District, Notification } from '../../types'
import { createProperty, getUserFavorites, getUserNotifications } from '../../services'
import { propertyTypes } from '../../data'
import './DashboardPage.css'

type TabType = 'add' | 'bookmarks' | 'notifications'

export const DashboardPage: React.FC = () => {
  const { t, language } = useLanguage()
  const { user, isAuthenticated } = useAuth()

  const [activeTab, setActiveTab] = React.useState<TabType>('add')
  const [bookmarkedProperties, setBookmarkedProperties] = React.useState<Property[]>([])
  const [notifications, setNotifications] = React.useState<Notification[]>([])
  const [isLoading, setIsLoading] = React.useState(false)

  // Form state
  const [formData, setFormData] = React.useState({
    title: '',
    type: '' as PropertyType | '',
    city: '',
    address: '',
    price: 0,
    rooms: 0,
    description: '',
    contactEmail: '',
    contactPhone: ''
  })

  const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null)

  React.useEffect(() => {
    if (!isAuthenticated || !user) return

    const loadData = async () => {
      try {
        setIsLoading(true)
        const [fav, notif] = await Promise.all([
          getUserFavorites(),
          getUserNotifications(user.id)
        ])
        setBookmarkedProperties(fav)
        setNotifications(notif)
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [isAuthenticated, user])

  const handleSubmitProperty = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAuthenticated || !user || !formData.title || !formData.type || !formData.city) {
      setMessage({ type: 'error', text: 'Please fill required fields' })
      return
    }

    try {
      setIsLoading(true)
      const newProperty: Omit<Property, 'id' | 'createdAt'> = {
        title: { az: formData.title, en: formData.title, ru: formData.title },
        type: formData.type as PropertyType,
        description: { az: formData.description, en: formData.description, ru: formData.description },
        city: formData.city,
        address: { az: formData.address, en: formData.address, ru: formData.address },
        price: { daily: formData.price, weekly: formData.price * 6, monthly: formData.price * 25, currency: 'AZN' },
        rooms: formData.rooms,
        district: 'baku' as District,
        area: 50,
        minGuests: 1,
        maxGuests: formData.rooms * 2,
        amenities: [],
        images: [],
        coordinates: { lat: 40.3856, lng: 49.8791 },
        ownerId: user.id,
        owner: {
          name: user.name || 'User',
          email: formData.contactEmail || user.email || '',
          phone: formData.contactPhone || user.phone || ''
        },
        views: 0,
        likes: [],
        favorites: [],
        comments: [],
        locationTags: [],
        locationCategory: 'rayon'
      }

      await createProperty(newProperty)
      setMessage({ type: 'success', text: language === 'en' ? 'Property added!' : language === 'ru' ? 'Недвижимость добавлена!' : 'Mülk əlavə edildi!' })
      setFormData({ title: '', type: '', city: '', address: '', price: 0, rooms: 0, description: '', contactEmail: '', contactPhone: '' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({ type: 'error', text: 'Error adding property' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1>{language === 'en' ? 'Dashboard' : language === 'ru' ? 'Панель' : 'Panel'}</h1>
        {user && <p className="user-info">{user.name || user.email}</p>}
      </div>

      <div className="dashboard-tabs">
        <button
          className={`tab-btn ${activeTab === 'add' ? 'active' : ''}`}
          onClick={() => setActiveTab('add')}
        >
          {language === 'en' ? 'Add Property' : language === 'ru' ? 'Добавить' : 'Elavə et'}
        </button>
        <button
          className={`tab-btn ${activeTab === 'bookmarks' ? 'active' : ''}`}
          onClick={() => setActiveTab('bookmarks')}
        >
          {language === 'en' ? 'Bookmarked' : language === 'ru' ? 'Закладки' : 'Əlaqələndirilmişlər'}
        </button>
        <button
          className={`tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          {language === 'en' ? 'Notifications' : language === 'ru' ? 'Уведомления' : 'Bildirişlər'} {notifications.length > 0 && `(${notifications.length})`}
        </button>
      </div>

      <div className="dashboard-content">
        {message && (
          <div className={`message message-${message.type}`}>
            {message.text}
          </div>
        )}

        {isLoading && <div className="loading">Loading...</div>}

        {activeTab === 'add' && (
          <div className="dashboard-section">
            <form onSubmit={handleSubmitProperty} className="property-form">
              <input
                type="text"
                placeholder={t.form.title || 'Title'}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />

              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as PropertyType })}
                required
              >
                <option value="">{t.form.selectType || 'Select type'}</option>
                {propertyTypes.map((type) => (
                  <option key={type} value={type}>
                    {t.propertyTypes[type]}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder={language === 'en' ? 'City' : language === 'ru' ? 'Город' : 'Şəhər'}
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                required
              />

              <input
                type="text"
                placeholder={t.form.address || 'Address'}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />

              <input
                type="number"
                placeholder={t.search.minPrice || 'Price per night'}
                value={formData.price || ''}
                onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
              />

              <input
                type="number"
                placeholder={language === 'en' ? 'Rooms' : language === 'ru' ? 'Комнат' : 'Otaqlar'}
                value={formData.rooms || ''}
                onChange={(e) => setFormData({ ...formData, rooms: parseInt(e.target.value) || 0 })}
              />

              <textarea
                placeholder={language === 'en' ? 'Description' : language === 'ru' ? 'Описание' : 'Açıqlama'}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
              />

              <input
                type="email"
                placeholder={language === 'en' ? 'Email' : 'Email'}
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
              />

              <input
                type="tel"
                placeholder={language === 'en' ? 'Phone' : language === 'ru' ? 'Телефон' : 'Telefon'}
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
              />

              <button type="submit" className="btn btn-primary" disabled={isLoading}>
                {isLoading ? '...' : language === 'en' ? 'Add Property' : language === 'ru' ? 'Добавить' : 'Elavə et'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'bookmarks' && (
          <div className="dashboard-section">
            {bookmarkedProperties.length === 0 ? (
              <p className="empty-state">{language === 'en' ? 'No bookmarked properties' : language === 'ru' ? 'Нет закладок' : 'Əlaqələndirilmiş mülk yoxdur'}</p>
            ) : (
              <div className="properties-grid">
                {bookmarkedProperties.map((prop) => (
                  <div key={prop.id} className="property-item">
                    <h3>{prop.title.az}</h3>
                    <p className="prop-meta">{prop.city} • {prop.rooms} rooms</p>
                    <p className="prop-price">${prop.price.daily}/night</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="dashboard-section">
            {notifications.length === 0 ? (
              <p className="empty-state">{language === 'en' ? 'No notifications' : language === 'ru' ? 'Нет уведомлений' : 'Bildirişlər yoxdur'}</p>
            ) : (
              <div className="notifications-list">
                {notifications.map((notif) => (
                  <div key={notif.id} className="notification-item">
                    <p>{notif.message}</p>
                    <span className="notif-date">{new Date(notif.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
