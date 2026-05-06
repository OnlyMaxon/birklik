import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { useLanguage } from '../../context'
import { useAuth } from '../../context'
import { Layout } from '../../layouts'
import { ImageGallery, Loading, ReportCommentModal } from '../../components'
import { moreFilterOptions, nearFilterOptions, cityLocationOptions, getOptionLabel } from '../../data'
import { getPropertyById, addCommentToProperty, deleteCommentFromProperty, incrementPropertyViews, addReplyToComment, addRatingToProperty, getUserRatingForProperty, getPropertyBookings } from '../../services'
import { toggleFavorite, isPropertyFavorited } from '../../services/favoritesService'
import { createBooking, hasUserBookedProperty } from '../../services'
import { getCsrfToken } from '../../services/csrfService'
import { createBookingNotification, createCommentNotification, createFavoriteNotification } from '../../services/notificationsService'
import { isPremiumActive } from '../../utils/premiumHelper'
import { sanitizeInput } from '../../utils/sanitization'
import { Booking } from '../../types'
import { Language, Property } from '../../types'
import './PropertyPage.css'
import * as logger from '../../services/logger'

const PropertyMap = React.lazy(() =>
  import('../../components/Map').then((mod) => ({ default: mod.PropertyMap }))
)

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
  const [isOwner, setIsOwner] = React.useState(false)

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
      
      // Check if user is owner
      if (data && user) {
        setIsOwner(data.ownerId === user.id)
      }
      
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

  const currencySymbol = (code: string) => code === 'AZN' ? '₼' : code

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
    
    // Block owner's unavailable dates (manual mark)
    if (property?.unavailableFrom && property?.unavailableTo) {
      if (dateISO >= property.unavailableFrom && dateISO <= property.unavailableTo) {
        return true
      }
    }
    
    // Block dates with approved bookings
    // Note: checkOutDate is NOT blocked (guest leaves that day, room is free)
    if (propertyBookings && propertyBookings.length > 0) {
      for (const booking of propertyBookings) {
        // Only block approved bookings
        if (booking.status === 'approved') {
          // Block from checkIn to day before checkOut (checkOut day is free)
          if (dateISO >= booking.checkInDate && dateISO < booking.checkOutDate) {
            return true
          }
        }
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
        
        // Clear selected dates to allow new booking
        setSelectedCheckIn('')
        setSelectedCheckOut('')
        
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
            message: `${user.name} booked your property`,
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
      
      // Check if it's a booking conflict error
      if (error instanceof Error && error.name === 'BookingConflictError') {
        setNotificationMessage(t.property.bookingConflict + ' ' + t.property.bookingConflictInfo)
      } else {
        setNotificationMessage(t.messages.bookingError)
      }
      setShowNotification(true)
    } finally {
      setIsBooking(false)
    }
  }

  const handleAddComment = async () => {
    if (!isAuthenticated || !user || !property || !newComment.trim()) return

    setIsPostingComment(true)
    const csrfToken = getCsrfToken()
    const success = await addCommentToProperty(
      property.id,
      user.id,
      user.name,
      user.avatar,
      newComment.trim(),
      csrfToken
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
      const csrfToken = getCsrfToken()
      const result = await addRatingToProperty(property.id, user.id, rating, user.name || 'User', csrfToken)
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
      const csrfToken = getCsrfToken()
      await toggleFavorite(property.id, user.id, isFavorited, csrfToken)
      
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
        if ((error as Error).name !== 'AbortError') {
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

  const handleMoveUp = () => {
    // Navigate to payment page for move up service
    // setNotificationMessage(language === 'en' ? 'Moving to payment...' : language === 'ru' ? 'Переводим на оплату...' : 'Ödəməyə keçir...')
    // TODO: For now just show alert
    alert(language === 'en' ? 'Move up feature coming soon' : language === 'ru' ? 'Функция перемещения вперед скоро' : 'Öndə getmə xüsusiyyəti tezliklə')
  }

  const handleUpgradeToVIP = () => {
    // Navigate to payment page for VIP upgrade
    alert(language === 'en' ? 'Upgrade to VIP - Payment processing...' : language === 'ru' ? 'Обновить до VIP - Обработка оплаты...' : 'VIP-ə yüksəltmə - Ödəniş işləməsi...')
  }

  const handleUpgradeToPremium = () => {
    // Navigate to payment page for Premium upgrade
    alert(language === 'en' ? 'Upgrade to Premium - Payment processing...' : language === 'ru' ? 'Обновить до Premium - Обработка оплаты...' : 'Premium-a yüksəltmə - Ödəniş işləməsi...')
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

  // Generate month label using translated month names from i18n
  const getMonthLabel = (date: Date) => {
    const monthIndex = date.getMonth()
    const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const
    const monthName = t.calendar.months[monthKeys[monthIndex]]
    const year = date.getFullYear()
    return `${monthName} ${year}`
  }

  const monthLabel = getMonthLabel(displayMonth)
  
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
  const selectedTotal = property ? selectedNights * property.price.daily : 0
  const selectedRangeBusy = (() => {
    if (!selectedCheckIn || !selectedCheckOut || !property.unavailableFrom || !property.unavailableTo) return false
    return selectedCheckIn <= property.unavailableTo && selectedCheckOut >= property.unavailableFrom
  })()
  

  const moreLabels = (property.extraFeatures || []).map((key) => getOptionLabel(moreFilterOptions, key, t))
  const nearLabels = (property.nearbyPlaces || []).map((key) => getOptionLabel(nearFilterOptions, key, t))
  const selectedLocationOptions = property.locationCategory ? cityLocationOptions[property.locationCategory] : null
  const locationLabels = selectedLocationOptions
    ? (property.locationTags || []).map((key) => getOptionLabel(selectedLocationOptions, key, t))
    : []

  return (
    <Layout>
      {showNotification && (
        <div className="pp-toast">{notificationMessage}</div>
      )}
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
            {/* Left Column */}
            <div className="property-main">
              <ImageGallery images={property.images} alt={getLocalizedText(property.title)} />

              {/* Title Card */}
              <div className="pp-title-card">
                <div className="pp-title-card__badges">
                  <span className="badge badge-primary">{t.propertyTypes[property.type]}</span>
                  {property.listingTier === 'vip' && (
                    <span className="badge badge-vip">VIP</span>
                  )}
                  {isPremiumActive(property.premiumExpiresAt) && (
                    <span className="badge badge-premium">Premium</span>
                  )}
                </div>
                <div className="pp-title-card__top">
                  <h1 className="property-title">{getLocalizedText(property.title)}</h1>
                  <div className="pp-header-actions">
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
                    <button onClick={handleShare} className="pp-share-btn" title={language === 'en' ? 'Share' : language === 'ru' ? 'Поделиться' : 'Paylaş'} aria-label="Share">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="pp-title-card__meta">
                  <span className="location">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    {t.districts[property.district]}
                  </span>
                  {property.rating && (
                    <span className="rating">
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                      {property.rating} ({property.reviews})
                    </span>
                  )}
                  {property.views && (
                    <span className="views-badge">
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                      {property.views} {t.property.views}
                    </span>
                  )}
                  {property.likes && property.likes.length > 0 && (
                    <span className="likes-badge">
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                      {property.likes.length}
                    </span>
                  )}
                </div>
                {isOwner && (
                  <div className="pp-owner-actions">
                    <button onClick={handleMoveUp} className="btn btn-sm btn-primary">
                      {language === 'en' ? '↑ Move Up' : language === 'ru' ? '↑ Вперед' : '↑ İreli Çək'}
                    </button>
                    {property.listingTier !== 'vip' && property.listingTier !== 'premium' && (
                      <button onClick={handleUpgradeToVIP} className="btn btn-sm pp-owner-btn--vip">
                        {language === 'en' ? '★ Upgrade to VIP' : language === 'ru' ? '★ VIP' : '★ VIP-ə yüksəlt'}
                      </button>
                    )}
                    {property.listingTier !== 'premium' && (
                      <button onClick={handleUpgradeToPremium} className="btn btn-sm pp-owner-btn--premium">
                        {language === 'en' ? '◆ Premium' : language === 'ru' ? '◆ Премиум' : '◆ Premium'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Details Bar */}
              <div className="pp-details-bar">
                <div className="pp-detail-item">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  <span className="pp-detail-value">{property.rooms}</span>
                  <span className="pp-detail-label">{t.property.rooms}</span>
                </div>
                <div className="pp-detail-item">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  </svg>
                  <span className="pp-detail-value">{property.area}</span>
                  <span className="pp-detail-label">{t.property.sqm}</span>
                </div>
                {(property.maxGuests || property.minGuests) && (
                  <div className="pp-detail-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    <span className="pp-detail-value">
                      {property.minGuests && property.maxGuests ? `${property.minGuests}–${property.maxGuests}` : property.maxGuests || property.minGuests}
                    </span>
                    <span className="pp-detail-label">{language === 'en' ? 'Guests' : language === 'ru' ? 'Гости' : 'Qonaqlar'}</span>
                  </div>
                )}
                <div className="pp-detail-item pp-detail-item--price">
                  <span className="pp-detail-currency-icon">₼</span>
                  <span className="pp-detail-price">{property.price.daily} {currencySymbol(property.price.currency)}</span>
                  <span className="pp-detail-label">/{t.property.perNight}</span>
                </div>
              </div>

              {/* Description */}
              {getLocalizedText(property.description) && (
                <div className="pp-section">
                  <div className="pp-section-header">
                    <div className="pp-section-icon pp-section-icon--blue">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                      </svg>
                    </div>
                    <h3 className="pp-section-title">{t.property.description}</h3>
                  </div>
                  <div className="pp-section-body">
                    <p>{getLocalizedText(property.description)}</p>
                  </div>
                </div>
              )}

              {/* Amenities */}
              {property.amenities && property.amenities.length > 0 && (
                <div className="pp-section">
                  <div className="pp-section-header">
                    <div className="pp-section-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                      </svg>
                    </div>
                    <h3 className="pp-section-title">{t.property.amenities}</h3>
                  </div>
                  <div className="pp-section-body">
                    <div className="pp-chips-wrap">
                      {property.amenities.map((amenity) => (
                        <span key={amenity} className="pp-amenity-chip">
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          {t?.amenities?.[amenity] || amenity}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* More Features */}
              {moreLabels.length > 0 && (
                <div className="pp-section">
                  <div className="pp-section-header">
                    <div className="pp-section-icon pp-section-icon--purple">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                      </svg>
                    </div>
                    <h3 className="pp-section-title">{t.property.more}</h3>
                  </div>
                  <div className="pp-section-body">
                    <div className="pp-chips-wrap">
                      {moreLabels.map((label) => (
                        <span key={label} className="pp-extra-chip">{label}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Nearby Places */}
              {nearLabels.length > 0 && (
                <div className="pp-section">
                  <div className="pp-section-header">
                    <div className="pp-section-icon pp-section-icon--amber">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                      </svg>
                    </div>
                    <h3 className="pp-section-title">{t.property.near}</h3>
                  </div>
                  <div className="pp-section-body">
                    <div className="pp-chips-wrap">
                      {nearLabels.map((label) => (
                        <span key={label} className="pp-near-chip">{label}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Address & Map */}
              <div className="pp-section">
                <div className="pp-section-header">
                  <div className="pp-section-icon pp-section-icon--purple">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                  </div>
                  <h3 className="pp-section-title">{t.property.address}</h3>
                </div>
                <div className="pp-section-body">
                  <p className="pp-address-text">{getLocalizedText(property.address)}</p>
                  {property.city && (
                    <p className="pp-city-line"><strong>{t.property.city}:</strong> {property.city}</p>
                  )}
                  {locationLabels.length > 0 && (
                    <div className="pp-chips-wrap" style={{ marginBottom: '0.75rem' }}>
                      {locationLabels.map((label) => (
                        <span key={label} className="location-tag-chip">{label}</span>
                      ))}
                    </div>
                  )}
                  <div className="pp-map-wrap">
                    <React.Suspense fallback={<div className="pp-map-loading" />}>
                      <PropertyMap properties={[property]} singleProperty={true} />
                    </React.Suspense>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="property-sidebar">

              {/* Price Card */}
              <div className="pp-price-card">
                <div className="pp-price-display">
                  <span className="pp-price-big">{property.price.daily}</span>
                  <span className="pp-price-cur">{currencySymbol(property.price.currency)}</span>
                  <span className="pp-price-per">/{t.property.perNight}</span>
                </div>
                {property.rating && (
                  <div className="pp-price-rating">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    {property.rating} ({property.reviews})
                  </div>
                )}
              </div>

              {/* Booking Card */}
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
                          <path d="M4 4h16v16H4z"/><path d="m22 6-10 7L2 6"/>
                        </svg>
                        {property.owner.email}
                      </a>
                    </>
                  ) : (
                    <p className="pp-contact-hint">{t.property.contactAfterBooking}</p>
                  )}
                </div>

                <div className="availability-card">
                  <h4>{availabilityTitle}</h4>
                  <p className={`availability-state ${isAvailable ? 'available' : 'busy'}`}>{availabilityNote}</p>

                  <div className="pp-cal-nav">
                    <button type="button" onClick={handlePrevMonth} className="pp-cal-nav-btn">←</button>
                    <div className="availability-month">{monthLabel}</div>
                    <button type="button" onClick={handleNextMonth} className="pp-cal-nav-btn">→</button>
                  </div>

                  <div className="availability-weekdays">
                    {weekDayLabels.map((label) => <span key={label}>{label}</span>)}
                  </div>
                  <div className="availability-calendar-grid">
                    {calendarCells.map((cell, index) => {
                      const isDisabled = isCellDisabled(cell.dateISO)
                      const isBusy = !!cell.dateISO && !!property.unavailableFrom && !!property.unavailableTo
                        && cell.dateISO >= property.unavailableFrom && cell.dateISO <= property.unavailableTo
                      const isBookedBlocked = !isBusy && !!cell.dateISO && cell.inMonth && !!propertyBookings?.some(
                        b => b.status === 'approved' && cell.dateISO! >= b.checkInDate && cell.dateISO! < b.checkOutDate
                      )
                      const isCheckIn = cell.dateISO === selectedCheckIn
                      const isCheckOut = cell.dateISO === selectedCheckOut
                      const isInRange = selectedCheckIn && selectedCheckOut && cell.dateISO && isDateInSelectedRange(cell.dateISO, selectedCheckIn, selectedCheckOut)
                      return (
                        <button
                          key={`${cell.dateISO || 'empty'}-${index}`}
                          onClick={() => !isDisabled && handleCalendarDateClick(cell.dateISO)}
                          disabled={isDisabled || !cell.inMonth}
                          className={['availability-day', cell.inMonth ? '' : 'outside', isBusy ? 'busy' : '', isBookedBlocked ? 'booked' : '', isCheckIn ? 'check-in' : '', isCheckOut ? 'check-out' : '', isInRange ? 'in-range' : '', !isDisabled && cell.inMonth ? 'selectable' : ''].filter(Boolean).join(' ')}
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
                      <p>{language === 'en' ? `${selectedNights} night(s)` : language === 'ru' ? `${selectedNights} ночей` : `${selectedNights} gecə`}</p>
                      <strong>{selectedTotal} {currencySymbol(property.price.currency)}</strong>
                    </div>
                  )}

                  {selectedCheckIn && selectedCheckOut && selectedNights > 0 && !selectedRangeBusy && (
                    <button
                      type="button"
                      onClick={handleMakeBooking}
                      disabled={isBooking || !isAuthenticated}
                      className={`btn pp-book-btn ${isAuthenticated ? 'btn-accent' : 'btn-ghost'}`}
                    >
                      {isBooking ? t.property.bookingButton : t.property.sendRequest}
                    </button>
                  )}

                  {hasBooked && <div className="pp-booking-success">{t.property.bookingSent}</div>}

                  {selectedRangeBusy && (
                    <p className="availability-range-warning">
                      {language === 'en' ? 'Selected dates overlap with occupied period.' : language === 'ru' ? 'Выбранные даты пересекаются с занятым периодом.' : 'Seçilən tarixlər məşğul günlərlə üst-üstə düşür.'}
                    </p>
                  )}
                  {availableFromNote && <p className="availability-next">{availableFromNote}</p>}

                  {propertyBookings.length > 0 && (
                    <div className="pp-latest-booking">
                      <p className="pp-latest-booking-label">
                        {language === 'en' ? 'Latest booking:' : language === 'ru' ? 'Последнее бронирование:' : 'Son sifariş:'}
                      </p>
                      <p className="pp-latest-booking-dates">
                        {propertyBookings[0].checkInDate} → {propertyBookings[0].checkOutDate}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Interactions */}
              <div className="property-interactions-section">
                <div className="interactions-rating">
                  <h4>{t.property.rateProperty}</h4>
                  {renderAverageRating()}
                  {renderStars()}
                </div>

                <div className="interactions-comments">
                  <h4>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    {t.property.comments} ({property.comments?.length || 0})
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
                      <button onClick={handleAddComment} disabled={isPostingComment || !newComment.trim()} className="btn btn-sm btn-primary">
                        {isPostingComment ? '...' : t.property.post}
                      </button>
                    </div>
                  )}
                  {!isAuthenticated && (
                    <p className="comments-sign-in-hint">{t.property.signInComment}</p>
                  )}

                  <div className="comments-list">
                    {property.comments && property.comments.length > 0 ? (
                      property.comments.map(comment => (
                        <div key={comment.id} className="comment-item">
                          <div className="comment-header">
                            <span className="comment-author">{comment.userName}</span>
                            {user?.id === comment.userId && (
                              <button onClick={() => handleDeleteComment(comment.id)} className="comment-delete-btn" title="Delete">✕</button>
                            )}
                          </div>
                          <p className="comment-text">{sanitizeInput(comment.text)}</p>
                          <p className="comment-date">{formatDate(comment.createdAt)}</p>

                          <div className="pp-comment-actions">
                            <button onClick={() => setReplyingToId(replyingToId === comment.id ? null : comment.id)} className="pp-comment-action-btn pp-comment-action-btn--reply">
                              {t.property.reply}
                            </button>
                            {isAuthenticated && (
                              <button onClick={() => setReportModal({ isOpen: true, commentId: comment.id, commentText: comment.text })} className="pp-comment-action-btn pp-comment-action-btn--report">
                                {language === 'en' ? 'Report' : language === 'ru' ? 'Пожаловаться' : 'Şikayyət'}
                              </button>
                            )}
                          </div>

                          {comment.replies && comment.replies.length > 0 && (
                            <div className="pp-replies">
                              <p className="pp-replies-count">
                                {comment.replies.length} {comment.replies.length === 1 ? (language === 'en' ? 'reply' : language === 'ru' ? 'ответ' : 'cavab') : (language === 'en' ? 'replies' : language === 'ru' ? 'ответов' : 'cavablar')}
                              </p>
                              {comment.replies.map(reply => (
                                <div key={reply.id} className="pp-reply-item">
                                  <p className="pp-reply-author">{reply.userName}</p>
                                  <p className="pp-reply-text">{reply.text}</p>
                                  <p className="pp-reply-date">{formatDate(reply.createdAt)}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {replyingToId === comment.id && isAuthenticated && (
                            <div className="pp-reply-form">
                              <p className="pp-reply-form-label">
                                {language === 'en' ? 'Replying to: ' : language === 'ru' ? 'Ответ на: ' : 'Cavab: '}
                                <strong>{comment.userName}</strong>
                              </p>
                              <div className="pp-reply-form-row">
                                <input
                                  type="text"
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  onKeyPress={(e) => e.key === 'Enter' && handleAddReply(comment.id)}
                                  placeholder={language === 'en' ? 'Write a reply...' : language === 'ru' ? 'Написать ответ...' : 'Cavab yazın...'}
                                />
                                <button onClick={() => handleAddReply(comment.id)} disabled={isPostingReply || !replyText.trim()} className="pp-reply-submit-btn">
                                  {isPostingReply ? '...' : (language === 'en' ? 'Reply' : language === 'ru' ? 'Ответить' : 'Cavab Ver')}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="comments-empty">
                        {language === 'en' ? 'No comments yet' : language === 'ru' ? 'Комментариев нет' : 'Hələ şərh yoxdur'}
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
