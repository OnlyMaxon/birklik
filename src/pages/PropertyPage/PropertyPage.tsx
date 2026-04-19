import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { useLanguage } from '../../context'
import { useAuth } from '../../context'
import { Layout } from '../../layouts'
import { ImageGallery, PropertyMap, Loading, ReportCommentModal } from '../../components'
import { moreFilterOptions, nearFilterOptions, cityLocationOptions, getOptionLabel } from '../../data'
import { getPropertyById, addCommentToProperty, deleteCommentFromProperty, incrementPropertyViews, addReplyToComment, addRatingToProperty, getUserRatingForProperty, getPropertyBookings } from '../../services'
import { toggleFavorite, isPropertyFavorited } from '../../services/favoritesService'
import { createBooking, hasUserBookedProperty } from '../../services'
import { getCsrfToken } from '../../services/csrfService'
import { createBookingNotification, createCommentNotification, createFavoriteNotification } from '../../services/notificationsService'
import { isPremiumActive, getPremiumRemainingDays } from '../../utils/premiumHelper'
import { Booking } from '../../types'
import { Language, Property } from '../../types'
import './PropertyPage.css'
import * as logger from '../../services/logger'

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
  const [showContactInfo, setShowContactInfo] = React.useState(false)
  const [isBooking, setIsBooking] = React.useState(false)
  const [newComment, setNewComment] = React.useState('')
  const [isPostingComment, setIsPostingComment] = React.useState(false)
  const [showNotification, setShowNotification] = React.useState(false)
  const [notificationMessage, setNotificationMessage] = React.useState('')
  const [reportModal, setReportModal] = React.useState<{ isOpen: boolean; commentId: string; commentText: string } | null>(null)
  const [replyingToId, setReplyingToId] = React.useState<string | null>(null)
  const [replyText, setReplyText] = React.useState('')
  const [isPostingReply, setIsPostingReply] = React.useState(false)
  const [userRating, setUserRating] = React.useState<number | null>(null)
  const [isSubmittingRating, setIsSubmittingRating] = React.useState(false)
  const [propertyBookings, setPropertyBookings] = React.useState<Booking[]>([])

  // Auto-hide notification after 3 seconds
  React.useEffect(() => {
    if (showNotification) {
      const timer = setTimeout(() => setShowNotification(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [showNotification])

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
        
        // Load user's rating for this property
        const rating = await getUserRatingForProperty(id, user.id)
        setUserRating(rating)
      }

      // Load all bookings for this property (to show first booking under price)
      if (id) {
        const bookings = await getPropertyBookings(id)
        setPropertyBookings(bookings)
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
    const today = getTodayISO()
    if (dateISO < today) {
      setNotificationMessage(t.property.cannotSelectPastDates)
      setShowNotification(true)
      return
    }

    // Check if date is booked
    if (isCellDisabled(dateISO)) {
      setNotificationMessage(t.property.dateNotAvailable)
      setShowNotification(true)
      return
    }

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

  const isCellDisabled = (dateISO?: string) => {
    if (!dateISO) return false
    const today = getTodayISO()
    // Block past dates
    if (dateISO < today) return true
    // Block booked dates
    if (property?.unavailableFrom && property?.unavailableTo) {
      if (dateISO >= property.unavailableFrom && dateISO <= property.unavailableTo) {
        return true
      }
    }
    return false
  }

  const handleMakeBooking = async () => {
    if (!isAuthenticated || !user || !property || !selectedCheckIn || !selectedCheckOut) {
      alert(t.property.errorSelectDates)
      return
    }

    setIsBooking(true)
    try {
      const booking: Omit<Booking, 'id' | 'createdAt'> = {
        propertyId: property.id,
        userId: user.id,
        ownerId: property.ownerId || '',
        userName: user.name,
        userEmail: user.email,
        userPhone: user.phone,
        checkInDate: selectedCheckIn,
        checkOutDate: selectedCheckOut,
        nights: selectedNights,
        totalPrice: selectedTotal,
        status: 'pending'
      }

      const csrfToken = getCsrfToken()
      const result = await createBooking(booking, csrfToken)
      if (result) {
        setHasBooked(true)
        setShowContactInfo(true)
        
        // Show toast notification
        const notifMsg = language === 'en' 
          ? 'Your booking has been added to your cabinet' 
          : language === 'ru' 
            ? 'Ваше бронирование добавлено в ваш кабинет' 
            : 'Sizin sifariş siz kabinetinizə əlavə edildI'
        setNotificationMessage(notifMsg)
        setShowNotification(true)
        
        // Send booking notification to property owner
        if (property.ownerId) {
          await createBookingNotification(property.ownerId, {
            userId: property.ownerId,
            type: 'booking',
            title: t.notifications.newBooking,
            message: `${user.name} booked your property for ${selectedNights} nights`,
            read: false,
            propertyId: property.id,
            bookingId: result.id,
            bookerName: user.name,
            bookerEmail: user.email,
            bookerPhone: user.phone,
            checkInDate: selectedCheckIn,
            checkOutDate: selectedCheckOut,
            relatedId: property.id,
            relatedUserId: user.id,
            relatedUserName: user.name
          })
        }
      } else {
        setNotificationMessage(t.messages.bookingError)
        setShowNotification(true)
      }
    } catch (error) {
      logger.error('Error making booking:', error)
      setNotificationMessage(t.messages.bookingError)
      setShowNotification(true)
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
      
      // Send comment notification to property owner
      if (property.ownerId && property.ownerId !== user.id && updated?.comments) {
        const lastComment = updated.comments[updated.comments.length - 1]
        await createCommentNotification(property.ownerId, {
          userId: property.ownerId,
          type: 'comment',
          title: t.notifications.newComment,
          message: `${user.name} commented: "${newComment.trim().substring(0, 50)}${newComment.trim().length > 50 ? '...' : ''}"`,
          read: false,
          propertyId: property.id,
          commentId: lastComment?.id || '',
          commenterName: user.name,
          commentText: newComment.trim(),
          relatedId: property.id,
          relatedUserId: user.id,
          relatedUserName: user.name
        })
      }
    }

    setIsPostingComment(false)
  }

  const handleRating = async (rating: number) => {
    if (!isAuthenticated || !user || !property) {
      alert(t.property.signInRate)
      return
    }

    // Check if user has booked this property
    if (!hasBooked) {
      alert(t.property.onlyRateBooked)
      return
    }

    setIsSubmittingRating(true)
    try {
      const result = await addRatingToProperty(property.id, user.id, rating, user.name || 'User')
      if (result.success) {
        setUserRating(rating)
        setNotificationMessage(t.property.rateSaved)
        setShowNotification(true)
        
        // Reload property to show updated rating
        const updated = await getPropertyById(property.id)
        setProperty(updated)
      } else if (result.hasBooked === false) {
        alert(t.property.onlyRateBooked)
      } else {
        setNotificationMessage(t.messages.ratingError)
        setShowNotification(true)
      }
    } catch (error) {
      logger.error('Error submitting rating:', error)
      setNotificationMessage(t.messages.ratingError)
      setShowNotification(true)
    } finally {
      setIsSubmittingRating(false)
    }
  }

  const renderStars = () => {
    return (
      <div className="stars-rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            className={`star-btn ${userRating === star ? 'active' : ''} ${star <= userRating! ? 'filled' : ''}`}
            onClick={() => handleRating(star)}
            disabled={!isAuthenticated || isSubmittingRating}
            title={`${star} ${t.property.star}`}
          >
            ★
          </button>
        ))}
      </div>
    )
  }

  const renderAverageRating = () => {
    const avgRating = property?.rating || 0
    const reviewCount = property?.reviews || 0
    return (
      <div className="average-rating">
        <span className="rating-value">{avgRating > 0 ? avgRating.toFixed(1) : '-'}</span>
        <span className="rating-text">
          {avgRating > 0 ? `(${reviewCount} ${t.property.reviewCount}${reviewCount !== 1 ? (language === 'en' ? 's' : language === 'ru' ? 'ов' : '') : ''})` : t.property.notRated}
        </span>
      </div>
    )
  }

  const handleFavoriteClick = async () => {
    if (!isAuthenticated || !user) {
      alert(t.property.signInBookmark)
      return
    }

    if (!property) return

    setIsFavoriting(true)
    try {
      await toggleFavorite(property.id, user.id, isFavorited)
      
      // Send favorite notification to property owner (only if adding to favorites)
      if (!isFavorited) {
        // Get fresh property data from Firestore to ensure we have ownerId
        const freshProperty = await getPropertyById(property.id)
        const ownerId = freshProperty?.ownerId
        
        if (ownerId && ownerId !== user.id) {
          await createFavoriteNotification(ownerId, {
            userId: ownerId,
            type: 'favorite',
            title: t.property.bookmarkAdded,
            message: `${user.name} added your property to favorites`,
            read: false,
            propertyId: property.id,
            favoriterName: user.name,
            relatedId: property.id,
            relatedUserId: user.id,
            relatedUserName: user.name
          })
        }
      }
      
      setIsFavorited(!isFavorited)
    } catch (error) {
      logger.error('Error toggling favorite:', error)
      alert(t.messages.errorUpdatingFavorites)
    } finally {
      setIsFavoriting(false)
    }
  }

  const handleShare = async () => {
    if (!property) return

    const propertyUrl = `${window.location.origin}/property/${property.id}`
    
    // Try using native Share API if available
    if (navigator.share) {
      try {
        await navigator.share({
          title: getLocalizedText(property.title),
          text: `Check out this property: ${getLocalizedText(property.title)}`,
          url: propertyUrl
        })
      } catch (error) {
        // User cancelled share, no need to alert
        if ((error as any).name !== 'AbortError') {
          logger.error('Error sharing:', error)
        }
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(propertyUrl)
        alert(language === 'en' ? 'Link copied to clipboard!' : language === 'ru' ? 'Ссылка скопирована в буфер обмена!' : 'Keçid buferə kopyalandı!')
      } catch (error) {
        logger.error('Error copying to clipboard:', error)
        alert(language === 'en' ? 'Failed to copy link' : language === 'ru' ? 'Не удалось скопировать ссылку' : 'Keçidi kopyalamaq mümkün olmadı')
      }
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

  const handleAddReply = async (parentCommentId: string) => {
    if (!isAuthenticated || !user || !property || !replyText.trim()) return

    setIsPostingReply(true)
    const success = await addReplyToComment(
      property.id,
      parentCommentId,
      user.id,
      user.name,
      user.avatar,
      replyText.trim()
    )

    if (success) {
      setReplyText('')
      setReplyingToId(null)
      // Reload property to show new reply
      const updated = await getPropertyById(property.id)
      setProperty(updated)
    }

    setIsPostingReply(false)
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
  const availabilityTitle = t.property.availability
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
      {/* Toast Notification */}
      {showNotification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#2e7d32',
          color: 'white',
          padding: '1rem 1.5rem',
          borderRadius: '6px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          zIndex: 1000,
          animation: 'slideDown 0.3s ease-out',
          maxWidth: '90%',
          textAlign: 'center',
          fontSize: '0.95rem',
          fontWeight: '500'
        }}>
          {notificationMessage}
        </div>
      )}
      <style>{`
        @keyframes slideDown {
          from {
            transform: translateX(-50%) translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
        }
      `}</style>
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
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={handleFavoriteClick}
                      disabled={isFavoriting}
                      className={`favorite-btn ${isFavorited ? 'favorited' : ''}`}
                      title={!isAuthenticated ? (language === 'en' ? 'Sign in to bookmark' : language === 'ru' ? 'Войдите чтобы добавить в закладки' : 'Bookmarklamaq üçün giriş yapın') : ''}
                      aria-label="Add to bookmarks"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                      </svg>
                    </button>
                    <button
                      onClick={handleShare}
                      className="share-btn"
                      title={language === 'en' ? 'Share property' : language === 'ru' ? 'Поделиться объявлением' : 'Əmlakı paylaş'}
                      aria-label="Share property"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#b7925d',
                        fontSize: '18px',
                        padding: '0.5rem',
                        borderRadius: '4px',
                        transition: 'background-color 0.3s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(183, 146, 93, 0.1)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="18" cy="5" r="3"/>
                        <circle cx="6" cy="12" r="3"/>
                        <circle cx="18" cy="19" r="3"/>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="property-meta">
                  <span className="badge badge-primary">{t.propertyTypes[property.type]}</span>
                  {isPremiumActive(property.premiumExpiresAt) && (
                    <span className="badge badge-premium" title={language === 'en' ? `Premium listing - ${getPremiumRemainingDays(property.premiumExpiresAt)} days remaining` : language === 'ru' ? `Премиум объявление - осталось ${getPremiumRemainingDays(property.premiumExpiresAt)} дней` : `Premium elan - ${getPremiumRemainingDays(property.premiumExpiresAt)} gün qalıb`}>
                      ⭐ Premium
                    </span>
                  )}
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
                  {property.views && (
                    <span className="views-badge">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                      {property.views} {t.property.views}
                    </span>
                  )}
                  {property.likes && property.likes.length > 0 && (
                    <span className="likes-badge">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                      {property.likes.length}
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
                    <h3>{t.property.more}</h3>
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
                    <h3>{t.property.near}</h3>
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
                      <strong>{t.property.city}:</strong> {property.city}
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
                  
                  {showContactInfo || hasBooked ? (
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
                      {t.property.contactAfterBooking}
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
                      const isDisabled = isCellDisabled(cell.dateISO)
                      const isBusy = !!cell.dateISO && !!property.unavailableFrom && !!property.unavailableTo
                        && cell.dateISO >= property.unavailableFrom
                        && cell.dateISO <= property.unavailableTo
                      
                      const isCheckIn = cell.dateISO === selectedCheckIn
                      const isCheckOut = cell.dateISO === selectedCheckOut
                      const isInRange = selectedCheckIn && selectedCheckOut && cell.dateISO && isDateInSelectedRange(cell.dateISO, selectedCheckIn, selectedCheckOut)

                      return (
                        <button
                          key={`${cell.dateISO || 'empty'}-${index}`}
                          onClick={() => !isDisabled && handleCalendarDateClick(cell.dateISO)}
                          disabled={isDisabled || !cell.inMonth}
                          className={`
                            availability-day 
                            ${cell.inMonth ? '' : 'outside'} 
                            ${isBusy ? 'busy' : ''} 
                            ${isCheckIn ? 'check-in' : ''} 
                            ${isCheckOut ? 'check-out' : ''} 
                            ${isInRange ? 'in-range' : ''}
                            ${!isDisabled && cell.inMonth ? 'selectable' : ''}
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
                      <span>{t.property.busyFrom}</span>
                      <strong>{formatDate(property.unavailableFrom)}</strong>
                    </div>
                    <div>
                      <span>{t.property.busyUntil}</span>
                      <strong>{formatDate(property.unavailableTo)}</strong>
                    </div>
                  </div>

                  {selectedCheckIn && (
                    <div className="availability-range-inputs">
                      <div className="selected-range-display">
                        <span>{t.property.checkIn}:</span>
                        <strong>{formatDate(selectedCheckIn)}</strong>
                      </div>
                      {selectedCheckOut && (
                        <div className="selected-range-display">
                          <span>{t.property.checkOut}:</span>
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

                  {selectedCheckIn && selectedCheckOut && selectedNights > 0 && !selectedRangeBusy && !hasBooked && (
                    <button
                      type="button"
                      onClick={handleMakeBooking}
                      disabled={isBooking || !isAuthenticated}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        marginTop: '0.75rem',
                        backgroundColor: isAuthenticated ? '#b7925d' : '#ccc',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        fontWeight: 'bold',
                        cursor: isAuthenticated && !isBooking ? 'pointer' : 'not-allowed',
                        transition: 'background-color 0.3s'
                      }}
                    >
                      {isBooking ? t.property.bookingButton : t.property.sendRequest}
                    </button>
                  )}

                  {hasBooked && (
                    <div style={{ padding: '0.5rem 0.75rem', marginTop: '0.75rem', backgroundColor: '#e8f5e9', border: '1px solid #4caf50', borderRadius: '6px', textAlign: 'center', color: '#2e7d32', fontWeight: 'bold', fontSize: '0.9rem' }}>
                      {t.property.bookingSent}
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
                    
                    {propertyBookings.length > 0 && (
                      <div className="first-booking-info" style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #eee' }}>
                        <p style={{ fontSize: '0.85rem', color: '#666', margin: '0.25rem 0' }}>
                          <strong>{language === 'en' ? 'Latest booking:' : language === 'ru' ? 'Последнее бронирование:' : 'Son bölmə:'}​</strong>
                        </p>
                        <p style={{ fontSize: '0.8rem', color: '#999', margin: '0.25rem 0' }}>
                          {propertyBookings[0].checkInDate} → {propertyBookings[0].checkOutDate}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Interactions Section */}
              <div className="property-interactions-section">
                {/* Rating Section */}
                <div className="interactions-rating">
                  <h4>{t.property.rateProperty}</h4>
                  {renderAverageRating()}
                  {renderStars()}
                </div>

                {/* Comments */}
                <div className="interactions-comments">
                  <h4>
                    💬 {t.property.comments} ({property.comments?.length || 0})
                  </h4>

                  {isAuthenticated && (
                    <div className="comments-input-area">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder={t.property.addComment}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                      />
                      <button
                        onClick={handleAddComment}
                        disabled={isPostingComment || !newComment.trim()}
                        className="btn btn-sm btn-primary"
                      >
                        {isPostingComment ? '...' : t.property.post}
                      </button>
                    </div>
                  )}

                  {!isAuthenticated && (
                    <p className="comments-sign-in-hint">
                      {t.property.signInComment}
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
                          
                          {/* Interaction Buttons */}
                          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #eee' }}>
                            <button
                              onClick={() => setReplyingToId(replyingToId === comment.id ? null : comment.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#27ae60',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: 500,
                                padding: 0,
                                textDecoration: 'underline',
                                textDecorationColor: '#27ae60'
                              }}
                            >
                              {t.property.reply}
                            </button>
                            {isAuthenticated && (
                              <button
                                onClick={() => setReportModal({ isOpen: true, commentId: comment.id, commentText: comment.text })}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#e74c3c',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem',
                                  fontWeight: 500,
                                  padding: 0,
                                  textDecoration: 'underline',
                                  textDecorationColor: '#e74c3c'
                                }}
                              >
                                {language === 'en' ? 'Report' : language === 'ru' ? 'Пожаловаться' : 'Şikayyət'}
                              </button>
                            )}
                          </div>

                          {/* Replies */}
                          {comment.replies && comment.replies.length > 0 && (
                            <div style={{ marginTop: '1rem', marginLeft: '1.5rem', paddingLeft: '1rem', borderLeft: '2px solid #e0e0e0' }}>
                              <p style={{ fontSize: '0.8rem', color: '#999', marginBottom: '0.5rem' }}>
                                {comment.replies.length} {comment.replies.length === 1 ? (language === 'en' ? 'reply' : language === 'ru' ? 'ответ' : 'cavab') : (language === 'en' ? 'replies' : language === 'ru' ? 'ответов' : 'cavablar')}
                              </p>
                              {comment.replies.map(reply => (
                                <div key={reply.id} style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f0f0f0' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.85rem', color: '#333', fontWeight: 500 }}>{reply.userName}</span>
                                  </div>
                                  <p style={{ fontSize: '0.9rem', color: '#555', margin: '0.3rem 0' }}>{reply.text}</p>
                                  <p style={{ fontSize: '0.75rem', color: '#999' }}>{formatDate(reply.createdAt)}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Reply Form */}
                          {replyingToId === comment.id && isAuthenticated && (
                            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #eee', backgroundColor: '#f9f9f9', padding: '0.75rem' }}>
                              <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>
                                {language === 'en' ? 'Replying to: ' : language === 'ru' ? 'Ответ на: ' : 'Cavab: '} 
                                <strong>{comment.userName}</strong>
                              </p>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                  type="text"
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  onKeyPress={(e) => e.key === 'Enter' && handleAddReply(comment.id)}
                                  placeholder={language === 'en' ? 'Write a reply...' : language === 'ru' ? 'Написать ответ...' : 'Cavab yazın...'}
                                  style={{
                                    flex: 1,
                                    padding: '0.5rem',
                                    borderRadius: '4px',
                                    border: '1px solid #ddd',
                                    fontSize: '0.9rem'
                                  }}
                                />
                                <button
                                  onClick={() => handleAddReply(comment.id)}
                                  disabled={isPostingReply || !replyText.trim()}
                                  style={{
                                    padding: '0.5rem 1rem',
                                    backgroundColor: '#27ae60',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: isPostingReply || !replyText.trim() ? 'not-allowed' : 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: 'bold',
                                    opacity: isPostingReply || !replyText.trim() ? 0.6 : 1
                                  }}
                                >
                                  {isPostingReply ? '...' : (language === 'en' ? 'Reply' : language === 'ru' ? 'Ответить' : 'Cavab Ver')}
                                </button>
                              </div>
                            </div>
                          )}
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

      {/* Report Comment Modal */}
      {reportModal && property && (
        <ReportCommentModal
          isOpen={reportModal.isOpen}
          onClose={() => setReportModal(null)}
          propertyId={property.id}
          commentId={reportModal.commentId}
          commentText={reportModal.commentText}
          reportedBy={user?.id || ''}
          reportedByName={user?.name || 'Anonymous'}
        />
      )}
    </Layout>
  )
}
