import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { useLanguage } from '../../context'
import { useAuth } from '../../context'
import { Layout } from '../../layouts'
import { ImageGallery, PropertyMap, Loading } from '../../components'
import { moreFilterOptions, nearFilterOptions, cityLocationOptions, getOptionLabel } from '../../data'
import { getPropertyById, addCommentToProperty, toggleLikeProperty, deleteCommentFromProperty, incrementPropertyViews } from '../../services'
import { toggleFavorite, isPropertyFavorited } from '../../services/favoritesService'
import { createBooking, hasUserBookedProperty } from '../../services'
import { Booking } from '../../types'
import { Language, Property } from '../../types'
import './PropertyPage.css'

interface CalendarCell {
  label: string
  dateISO?: string
  inMonth: boolean
}

const toISODate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const buildCalendarCells = (monthDate: Date): CalendarCell[] => {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const startWeekDay = (firstDay.getDay() + 6) % 7
  const startDate = new Date(firstDay)
  startDate.setDate(firstDay.getDate() - startWeekDay)

  const cells: CalendarCell[] = []
  for (let i = 0; i < 42; i += 1) {
    const current = new Date(startDate)
    current.setDate(startDate.getDate() + i)
    cells.push({
      label: String(current.getDate()),
      dateISO: toISODate(current),
      inMonth: current.getMonth() === monthDate.getMonth()
    })
  }

  return cells
}

export const PropertyPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const { language, t } = useLanguage()
  const { user, isAuthenticated } = useAuth()
  const [property, setProperty] = React.useState<Property | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isFavorited, setIsFavorited] = React.useState(false)
  const [isFavoriting, setIsFavoriting] = React.useState(false)
  const [selectedCheckIn, setSelectedCheckIn] = React.useState('')
  const [selectedCheckOut, setSelectedCheckOut] = React.useState('')
  const [displayMonth, setDisplayMonth] = React.useState(() => new Date())
  const [hasBooked, setHasBooked] = React.useState(false)
  const [isBooking, setIsBooking] = React.useState(false)
  const [newComment, setNewComment] = React.useState('')
  const [isPostingComment, setIsPostingComment] = React.useState(false)

  React.useEffect(() => {
    const loadProperty = async () => {
      if (!id) {
        setProperty(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      const data = await getPropertyById(id)
      setProperty(data)
      
      // Check if favorited
      if (data && user) {
        const favorited = isPropertyFavorited(data.favorites || [], user.id)
        setIsFavorited(favorited)
      }
      
      // Increment views count
      if (data) {
        await incrementPropertyViews(id)
      }
      
      // Check if user has already booked
      if (isAuthenticated && user) {
        const booked = await hasUserBookedProperty(user.id, id)
        setHasBooked(booked)
      }
      
      setIsLoading(false)
    }

    loadProperty()
  }, [id, isAuthenticated, user])

  const getLocalizedText = (text: Partial<Record<Language, string>>) => text[language] || text.az || text.en || ''

  const formatDate = (value?: string) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : language === 'ru' ? 'ru-RU' : 'az-Latn-AZ').format(date)
  }

  const getTodayISO = () => new Date().toISOString().split('T')[0]

  const isOccupationExpired = (item: Property) => {
    if (!item.unavailableTo) return false
    return item.unavailableTo < getTodayISO()
  }

  // Handle calendar date click for range selection
  const handleCalendarDateClick = (dateISO: string | undefined) => {
    if (!dateISO) return

    // If no check-in selected, set it
    if (!selectedCheckIn) {
      setSelectedCheckIn(dateISO)
      return
    }

    // If no check-out selected, set it
    if (!selectedCheckOut) {
      // If clicked date is before check-in, swap them
      if (dateISO < selectedCheckIn) {
        setSelectedCheckOut(selectedCheckIn)
        setSelectedCheckIn(dateISO)
      } else {
        setSelectedCheckOut(dateISO)
      }
      return
    }

    // If both selected, clicking a date starts new selection
    setSelectedCheckIn(dateISO)
    setSelectedCheckOut('')
  }

  const isDateInSelectedRange = (dateISO: string | undefined, checkIn: string, checkOut: string) => {
    if (!dateISO) return false
    return dateISO >= checkIn && dateISO <= checkOut
  }

  const handleMakeBooking = async () => {
    if (!isAuthenticated || !user || !property || !selectedCheckIn || !selectedCheckOut) {
      alert(language === 'en' ? 'Please select dates and sign in' : language === 'ru' ? 'Пожалуйста, выберите даты и войдите' : 'Lütfen tarix seçin və daxil olun')
      return
    }

    setIsBooking(true)
    try {
      const booking: Omit<Booking, 'id' | 'createdAt'> = {
        propertyId: property.id,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userPhone: user.phone,
        checkInDate: selectedCheckIn,
        checkOutDate: selectedCheckOut,
        nights: selectedNights,
        totalPrice: selectedTotal,
        status: 'active'
      }

      const result = await createBooking(booking)
      if (result) {
        setHasBooked(true)
        alert(language === 'en' ? 'Booking confirmed!' : language === 'ru' ? 'Бронирование подтверждено!' : 'Sifariş təsdiq edildi!')
      } else {
        alert(language === 'en' ? 'Error creating booking' : language === 'ru' ? 'Ошибка при создании бронирования' : 'Sifariş yaratılma xətası')
      }
    } catch (error) {
      console.error('Error making booking:', error)
      alert(language === 'en' ? 'Error making booking' : language === 'ru' ? 'Ошибка при бронировании' : 'Sifariş xətası')
    } finally {
      setIsBooking(false)
    }
  }

  const handleAddComment = async () => {
    if (!isAuthenticated || !user || !property || !newComment.trim()) return

    setIsPostingComment(true)
    const success = await addCommentToProperty(
      property.id,
      user.id,
      user.name,
      user.avatar,
      newComment.trim()
    )

    if (success) {
      setNewComment('')
      // Reload property to show new comment
      const updated = await getPropertyById(property.id)
      setProperty(updated)
    }

    setIsPostingComment(false)
  }

  const handleToggleLike = async () => {
    if (!isAuthenticated || !user || !property) return

    const success = await toggleLikeProperty(property.id, user.id)
    if (success) {
      // Reload property to show like count
      const updated = await getPropertyById(property.id)
      setProperty(updated)
    }
  }

  const handleFavoriteClick = async () => {
    if (!isAuthenticated || !user) {
      alert(language === 'en' ? 'Please sign in to add favorites' : language === 'ru' ? 'Пожалуйста, войдите чтобы добавить в избранные' : 'Favorilere eklemek için giriş yapın')
      return
    }

    if (!property) return

    setIsFavoriting(true)
    try {
      await toggleFavorite(property.id, user.id, isFavorited)
      setIsFavorited(!isFavorited)
    } catch (error) {
      console.error('Error toggling favorite:', error)
      alert(language === 'en' ? 'Error updating favorites' : language === 'ru' ? 'Ошибка при обновлении избранных' : 'Favori güncellenirken hata oluştu')
    } finally {
      setIsFavoriting(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!property || !user) return

    const success = await deleteCommentFromProperty(property.id, commentId)
    if (success) {
      // Reload property
      const updated = await getPropertyById(property.id)
      setProperty(updated)
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <Loading message={t.messages.loading} />
      </Layout>
    )
  }

  if (!property) {
    return (
      <Layout>
        <div className="container py-8">
          <div className="not-found">
            <h2>{t.messages.error}</h2>
            <p>Property not found</p>
            <Link to="/" className="btn btn-primary">{t.nav.home}</Link>
          </div>
        </div>
      </Layout>
    )
  }

  const isAvailable = property.isActive !== false || isOccupationExpired(property)
  const availabilityTitle = language === 'en' ? 'Availability calendar' : language === 'ru' ? 'Календарь доступности' : 'Mövcudluq təqvimi'
  const availabilityNote = isAvailable
    ? (language === 'en' ? 'Currently available for booking.' : language === 'ru' ? 'Сейчас доступно для аренды.' : 'Hazırda sifariş üçün açıqdır.')
    : (language === 'en' ? 'Temporarily occupied and hidden from public listing.' : language === 'ru' ? 'Временно занято и скрыто из общего списка.' : 'Müvəqqəti məşğuldur və ümumi siyahıda göstərilmir.')
  const availableFromNote = !isAvailable && property.unavailableTo
    ? (language === 'en' ? `Available again from ${formatDate(property.unavailableTo)}.` : language === 'ru' ? `Снова будет доступно с ${formatDate(property.unavailableTo)}.` : `${formatDate(property.unavailableTo)} tarixindən sonra yenidən boş olacaq.`)
    : ''

  const monthLabel = new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : language === 'ru' ? 'ru-RU' : 'az-Latn-AZ', {
    month: 'long',
    year: 'numeric'
  }).format(displayMonth)
  
  const handlePrevMonth = () => {
    setDisplayMonth(prev => {
      const newMonth = new Date(prev)
      newMonth.setMonth(newMonth.getMonth() - 1)
      return newMonth
    })
  }

  const handleNextMonth = () => {
    setDisplayMonth(prev => {
      const newMonth = new Date(prev)
      newMonth.setMonth(newMonth.getMonth() + 1)
      return newMonth
    })
  }

  const weekDayLabels = language === 'en'
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : language === 'ru'
      ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
      : ['B.e', 'Ç.a', 'Ç', 'C.a', 'C', 'Ş', 'B']
  const calendarCells = buildCalendarCells(displayMonth)
  const oneDayMs = 24 * 60 * 60 * 1000
  const selectedNights = (() => {
    if (!selectedCheckIn || !selectedCheckOut) return 0
    const start = new Date(selectedCheckIn)
    const end = new Date(selectedCheckOut)
    const diff = Math.ceil((end.getTime() - start.getTime()) / oneDayMs)
    return diff > 0 ? diff : 0
  })()
  const selectedTotal = selectedNights * property.price.daily
  const selectedRangeBusy = (() => {
    if (!selectedCheckIn || !selectedCheckOut || !property.unavailableFrom || !property.unavailableTo) return false
    return selectedCheckIn <= property.unavailableTo && selectedCheckOut >= property.unavailableFrom
  })()
  const moreLabels = (property.extraFeatures || []).map((key) => getOptionLabel(moreFilterOptions, key, language))
  const nearLabels = (property.nearbyPlaces || []).map((key) => getOptionLabel(nearFilterOptions, key, language))
  const selectedLocationOptions = property.locationCategory ? cityLocationOptions[property.locationCategory] : null
  const locationLabels = selectedLocationOptions
    ? (property.locationTags || []).map((key) => getOptionLabel(selectedLocationOptions, key, language))
    : []

  return (
    <Layout>
      <div className="property-page">
        <div className="container">
          {/* Breadcrumb */}
          <nav className="breadcrumb">
            <Link to="/">{t.nav.home}</Link>
            <span>/</span>
            <span>{t.districts[property.district]}</span>
            <span>/</span>
            <span>{getLocalizedText(property.title)}</span>
          </nav>

          {/* Main Content */}
          <div className="property-layout">
            {/* Left Column - Gallery & Details */}
            <div className="property-main">
              <ImageGallery 
                images={property.images} 
                alt={getLocalizedText(property.title)} 
              />

              <div className="property-info card">
                <div className="property-header-top">
                  <h1 className="property-title">{getLocalizedText(property.title)}</h1>
                  <button
                    onClick={handleFavoriteClick}
                    disabled={isFavoriting}
                    className={`favorite-btn ${isFavorited ? 'favorited' : ''}`}
                    title={!isAuthenticated ? (language === 'en' ? 'Sign in to favorite' : language === 'ru' ? 'Войдите чтобы добавить в избранные' : 'Favorilere eklemek için giriş yapın') : ''}
                    aria-label="Add to favorites"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                  </button>
                </div>
                
                <div className="property-meta">
                  <span className="badge badge-primary">{t.propertyTypes[property.type]}</span>
                  <span className="location">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    {t.districts[property.district]}
                  </span>
                  {property.rating && (
                    <span className="rating">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                      {property.rating} ({property.reviews})
                    </span>
                  )}
                </div>

                <div className="property-features">
                  <div className="feature">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                      <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    <div>
                      <span className="feature-value">{property.rooms}</span>
                      <span className="feature-label">{t.property.rooms}</span>
                    </div>
                  </div>
                  <div className="feature">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    </svg>
                    <div>
                      <span className="feature-value">{property.area}</span>
                      <span className="feature-label">{t.property.sqm}</span>
                    </div>
                  </div>
                </div>

                <div className="property-section">
                  <h3>{t.property.description}</h3>
                  <p>{getLocalizedText(property.description)}</p>
                </div>

                <div className="property-section">
                  <h3>{t.property.amenities}</h3>
                  <div className="amenities-grid">
                    {(property.amenities || []).map((amenity) => (
                      <span key={amenity} className="amenity-item">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        {t.amenities[amenity]}
                      </span>
                    ))}
                  </div>
                </div>

                {moreLabels.length > 0 && (
                  <div className="property-section">
                    <h3>{language === 'en' ? 'More' : language === 'ru' ? 'Дополнительно' : 'Əlavə'}</h3>
                    <div className="amenities-grid">
                      {moreLabels.map((label) => (
                        <span key={label} className="amenity-item extra-item">
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {nearLabels.length > 0 && (
                  <div className="property-section">
                    <h3>{language === 'en' ? 'Near' : language === 'ru' ? 'Рядом' : 'Yaxında'}</h3>
                    <div className="amenities-grid">
                      {nearLabels.map((label) => (
                        <span key={label} className="amenity-item extra-item">
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="property-section">
                  <h3>{t.property.address}</h3>
                  <p>{getLocalizedText(property.address)}</p>
                  {property.city && (
                    <p className="property-city-line">
                      <strong>{language === 'en' ? 'City' : language === 'ru' ? 'Город' : 'Şəhər'}:</strong> {property.city}
                    </p>
                  )}
                  {locationLabels.length > 0 && (
                    <div className="location-tags-inline">
                      {locationLabels.map((label) => (
                        <span key={label} className="location-tag-chip">{label}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="property-section">
                  <h3>{t.property.location}</h3>
                  <PropertyMap 
                    properties={[property]} 
                    singleProperty={true}
                  />
                </div>
              </div>
            </div>

            {/* Right Column - Booking Card */}
            <div className="property-sidebar">
              <div className="booking-card card">
                <div className="owner-info owner-info-priority">
                  <h4>{t.property.contact}</h4>
                  <p className="owner-name">{property.owner.name}</p>
                  
                  {hasBooked || selectedCheckIn && selectedCheckOut ? (
                    <>
                      <a href={`tel:${property.owner.phone}`} className="owner-phone">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                        {property.owner.phone}
                      </a>
                      <a href={`mailto:${property.owner.email}`} className="owner-phone owner-email">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 4h16v16H4z"/>
                          <path d="m22 6-10 7L2 6"/>
                        </svg>
                        {property.owner.email}
                      </a>
                    </>
                  ) : (
                    <p style={{ fontSize: '0.9rem', color: '#9b7448', marginTop: '0.5rem' }}>
                      {language === 'en' ? 'Contact info will appear after booking' : language === 'ru' ? 'Контактная информация появится после бронирования' : 'Məlumata bron etdikdən sonra nəzər salacaq'}
                    </p>
                  )}
                </div>

                <div className="availability-card">
                  <h4>{availabilityTitle}</h4>
                  <p className={`availability-state ${isAvailable ? 'available' : 'busy'}`}>{availabilityNote}</p>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <button 
                      type="button"
                      onClick={handlePrevMonth}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.3rem 0.5rem', fontSize: '1.2rem', color: '#7a6b5d' }}
                    >
                      ←
                    </button>
                    <div className="availability-month">{monthLabel}</div>
                    <button 
                      type="button"
                      onClick={handleNextMonth}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.3rem 0.5rem', fontSize: '1.2rem', color: '#7a6b5d' }}
                    >
                      →
                    </button>
                  </div>

                  <div className="availability-weekdays">
                    {weekDayLabels.map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                  <div className="availability-calendar-grid">
                    {calendarCells.map((cell, index) => {
                      const isBusy = !!cell.dateISO && !!property.unavailableFrom && !!property.unavailableTo
                        && cell.dateISO >= property.unavailableFrom
                        && cell.dateISO <= property.unavailableTo
                      
                      const isCheckIn = cell.dateISO === selectedCheckIn
                      const isCheckOut = cell.dateISO === selectedCheckOut
                      const isInRange = selectedCheckIn && selectedCheckOut && cell.dateISO && isDateInSelectedRange(cell.dateISO, selectedCheckIn, selectedCheckOut)

                      return (
                        <button
                          key={`${cell.dateISO || 'empty'}-${index}`}
                          onClick={() => handleCalendarDateClick(cell.dateISO)}
                          disabled={isBusy || !cell.inMonth}
                          className={`
                            availability-day 
                            ${cell.inMonth ? '' : 'outside'} 
                            ${isBusy ? 'busy' : ''} 
                            ${isCheckIn ? 'check-in' : ''} 
                            ${isCheckOut ? 'check-out' : ''} 
                            ${isInRange ? 'in-range' : ''}
                            ${!isBusy && cell.inMonth ? 'selectable' : ''}
                          `}
                          type="button"
                        >
                          {cell.label}
                        </button>
                      )
                    })}
                  </div>
                  <div className="availability-dates">
                    <div>
                      <span>{language === 'en' ? 'Busy from' : language === 'ru' ? 'Занято с' : 'Məşğul başlanğıc'}</span>
                      <strong>{formatDate(property.unavailableFrom)}</strong>
                    </div>
                    <div>
                      <span>{language === 'en' ? 'Busy until' : language === 'ru' ? 'Занято до' : 'Məşğul bitiş'}</span>
                      <strong>{formatDate(property.unavailableTo)}</strong>
                    </div>
                  </div>

                  {selectedCheckIn && (
                    <div className="availability-range-inputs">
                      <div className="selected-range-display">
                        <span>{language === 'en' ? 'Check-in' : language === 'ru' ? 'Заезд' : 'Giriş tarixi'}:</span>
                        <strong>{formatDate(selectedCheckIn)}</strong>
                      </div>
                      {selectedCheckOut && (
                        <div className="selected-range-display">
                          <span>{language === 'en' ? 'Check-out' : language === 'ru' ? 'Выезд' : 'Çıxış tarixi'}:</span>
                          <strong>{formatDate(selectedCheckOut)}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedNights > 0 && (
                    <div className="availability-total-box">
                      <p>
                        {language === 'en'
                          ? `${selectedNights} night(s)`
                          : language === 'ru'
                            ? `${selectedNights} ночей`
                            : `${selectedNights} gecə`}
                      </p>
                      <strong>{selectedTotal} {property.price.currency}</strong>
                    </div>
                  )}

                  {selectedNights > 0 && !selectedRangeBusy && !hasBooked && (
                    <button
                      type="button"
                      onClick={handleMakeBooking}
                      disabled={isBooking || !isAuthenticated}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        marginTop: '1rem',
                        backgroundColor: isAuthenticated ? '#b7925d' : '#ccc',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        cursor: isAuthenticated && !isBooking ? 'pointer' : 'not-allowed',
                        transition: 'background-color 0.3s'
                      }}
                    >
                      {isBooking ? (language === 'en' ? 'Booking...' : language === 'ru' ? 'Бронирование...' : 'Sifariş edilir...') : (language === 'en' ? 'Book Now' : language === 'ru' ? 'Забронировать' : 'Bron Et')}
                    </button>
                  )}

                  {hasBooked && (
                    <div style={{ width: '100%', padding: '0.75rem 1rem', marginTop: '1rem', backgroundColor: '#e8f5e9', border: '1px solid #4caf50', borderRadius: '6px', textAlign: 'center', color: '#2e7d32', fontWeight: 'bold' }}>
                      {language === 'en' ? '✓ Booked' : language === 'ru' ? '✓ Забронировано' : '✓ Bron edildi'}
                    </div>
                  )}

                  {selectedRangeBusy && (
                    <p className="availability-range-warning">
                      {language === 'en'
                        ? 'Selected dates overlap with occupied period.'
                        : language === 'ru'
                          ? 'Выбранные даты пересекаются с занятым периодом.'
                          : 'Seçilən tarixlər məşğul günlərlə üst-üstə düşür.'}
                    </p>
                  )}
                  {availableFromNote && <p className="availability-next">{availableFromNote}</p>}

                  <div className="price-section">
                    <div className="price-row">
                      <span className="price-label">{t.property.perNight}:</span>
                      <span className="price-value">{property.price.daily} {property.price.currency}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Likes and Comments Section */}
              <div className="property-interactions-section">
                {/* Likes */}
                <div className="interactions-likes">
                  <button
                    onClick={handleToggleLike}
                    disabled={!isAuthenticated}
                    className={`btn btn-sm ${property.likes?.includes(user?.id || '') ? 'btn-primary' : 'btn-outline'}`}
                    title={!isAuthenticated ? 'Sign in to like' : ''}
                  >
                    ❤️ {language === 'en' ? 'Like' : language === 'ru' ? 'Нравится' : 'Beğən'}
                  </button>
                  <span className="likes-count">
                    {property.likes?.length || 0}
                  </span>
                </div>

                {/* Comments */}
                <div className="interactions-comments">
                  <h4>
                    💬 {language === 'en' ? 'Comments' : language === 'ru' ? 'Комментарии' : 'Şərhlər'} ({property.comments?.length || 0})
                  </h4>

                  {isAuthenticated && (
                    <div className="comments-input-area">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder={language === 'en' ? 'Add a comment...' : language === 'ru' ? 'Добавить комментарий...' : 'Şərh əlavə edin...'}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                      />
                      <button
                        onClick={handleAddComment}
                        disabled={isPostingComment || !newComment.trim()}
                        className="btn btn-sm btn-primary"
                      >
                        {isPostingComment ? '...' : language === 'en' ? 'Post' : language === 'ru' ? 'Отправить' : 'Yolla'}
                      </button>
                    </div>
                  )}

                  {!isAuthenticated && (
                    <p className="comments-sign-in-hint">
                      {language === 'en' ? 'Sign in to comment' : language === 'ru' ? 'Войдите чтобы комментировать' : 'Şərhləmək üçün daxil olun'}
                    </p>
                  )}

                  <div className="comments-list">
                    {property.comments && property.comments.length > 0 ? (
                      property.comments.map(comment => (
                        <div key={comment.id} className="comment-item">
                          <div className="comment-header">
                            <span className="comment-author">{comment.userName}</span>
                            {user?.id === comment.userId && (
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="comment-delete-btn"
                                title="Delete"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                          <p className="comment-text">{comment.text}</p>
                          <p className="comment-date">{formatDate(comment.createdAt)}</p>
                        </div>
                      ))
                    ) : (
                      <p className="comments-empty">
                        {language === 'en' ? 'No comments yet' : language === 'ru' ? 'Комментариев нет' : 'Henüz şərh yoxdur'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
