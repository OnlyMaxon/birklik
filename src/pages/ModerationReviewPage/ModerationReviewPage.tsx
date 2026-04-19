import React from 'react'
import { useParams, Navigate, useNavigate } from 'react-router-dom'
import { Layout } from '../../layouts'
import { Loading } from '../../components'
import { useAuth, useLanguage } from '../../context'
import { getPropertyById, approveProperty } from '../../services'
import { createListingRejectedNotification } from '../../services/notificationsService'
import { isModerator } from '../../config/constants'
import { Property, Language } from '../../types'
import '../PropertyPage/PropertyPage.css'
import './ModerationReviewPage.css'

export const ModerationReviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, firebaseUser } = useAuth()
  const { language, t } = useLanguage()
  
  const [property, setProperty] = React.useState<Property | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [error, setError] = React.useState('')
  const [isModeratorUser, setIsModeratorUser] = React.useState(false)
  const [tokenLoaded, setTokenLoaded] = React.useState(false)
  const [rejectionReason, setRejectionReason] = React.useState('')
  const [showRejectForm, setShowRejectForm] = React.useState(false)

  // Check if user is moderator
  React.useEffect(() => {
    const checkModerator = async () => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdTokenResult()
        setIsModeratorUser(isModerator(token))
      }
      setTokenLoaded(true)
    }
    checkModerator()
  }, [firebaseUser])

  // Load property
  React.useEffect(() => {
    const loadProperty = async () => {
      if (!id || !tokenLoaded || !isModeratorUser) return

      setIsLoading(true)
      setError('')
      
      try {
        const prop = await getPropertyById(id)
        if (!prop) {
          setError(language === 'en' ? 'Property not found' : language === 'ru' ? 'Объявление не найдено' : 'Elan tapılmadı')
          setIsLoading(false)
          return
        }
        setProperty(prop)
      } catch (err) {
        setError(language === 'en' ? 'Error loading property' : language === 'ru' ? 'Ошибка загрузки' : 'Yükləmə xətası')
      }
      setIsLoading(false)
    }

    loadProperty()
  }, [id, tokenLoaded, isModeratorUser, language])

  if (!tokenLoaded) {
    return <Loading fullScreen message="Loading..." brand />
  }

  if (!isAuthenticated || !isModeratorUser) {
    return <Navigate to="/dashboard" replace />
  }

  if (isLoading) {
    return <Loading fullScreen message={t.messages.loading} brand />
  }

  if (!property || error) {
    return (
      <Layout>
        <section className="property-page">
          <div className="container">
            <div className="error-message">{error}</div>
            <button className="btn btn-primary" onClick={() => navigate(-1)}>
              {language === 'en' ? 'Back' : language === 'ru' ? 'Назад' : 'Geri'}
            </button>
          </div>
        </section>
      </Layout>
    )
  }

  const getLocalizedText = (text: Partial<Record<Language, string>>) => 
    text[language] || text.az || text.en || ''

  const handleApprove = async () => {
    setIsProcessing(true)
    setError('')

    const ok = await approveProperty(property.id)
    if (!ok) {
      setError(language === 'en' ? 'Could not approve listing.' : language === 'ru' ? 'Не удалось одобрить объявление.' : 'Elanı təsdiqləmək mümkün olmadı.')
      setIsProcessing(false)
      return
    }

    // Redirect to moderation page
    navigate('/dashboard/review')
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError(language === 'en' ? 'Please provide a rejection reason' : language === 'ru' ? 'Пожалуйста, укажите причину отказа' : 'Lütfən rədd səbəbini qeyd edin')
      return
    }

    setIsProcessing(true)
    setError('')

    try {
      // Send rejection notification to property owner
      if (property.ownerId) {
        await createListingRejectedNotification(property.ownerId, {
          type: 'listingRejected',
          title: language === 'en' ? 'Listing Rejected' : language === 'ru' ? 'Объявление отклонено' : 'Elan rədd edildi',
          message: language === 'en' 
            ? `Your listing has been rejected: ${rejectionReason}`
            : language === 'ru'
            ? `Ваше объявление было отклонено: ${rejectionReason}`
            : `Elanınız rədd edildi: ${rejectionReason}`,
          read: false,
          propertyId: property.id,
          propertyTitle: getLocalizedText(property.title),
          rejectionReason: rejectionReason
        })
      }

      // Redirect back to moderation page
      navigate('/dashboard/review')
    } catch (err) {
      setError(language === 'en' ? 'Error sending rejection notification' : language === 'ru' ? 'Ошибка отправки уведомления' : 'Notification göndərməsi xətası')
      setIsProcessing(false)
    }
  }

  const handleCancel = () => {
    navigate(-1)
  }

  return (
    <Layout>
      <section className="moderation-review-page">
        <div className="container moderation-review-layout">
          <div className="review-header">
            <h1>{language === 'en' ? 'Review Listing' : language === 'ru' ? 'Проверка объявления' : 'Elanı Baxış'}</h1>
            <button className="btn btn-ghost" onClick={() => navigate(-1)}>
              {language === 'en' ? '← Back' : language === 'ru' ? '← Назад' : '← Geri'}
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="review-content">
            {/* Main Property Info */}
            <article className="review-card">
              <div className="review-image-section">
                <img 
                  src={property.images?.[0] || 'https://via.placeholder.com/600x400?text=No+Image'} 
                  alt={getLocalizedText(property.title)} 
                  className="review-image"
                />
              </div>

              <div className="review-info">
                <h2>{getLocalizedText(property.title)}</h2>
                
                <div className="review-meta-grid">
                  <div className="meta-item">
                    <strong>{language === 'en' ? 'Type:' : language === 'ru' ? 'Тип:' : 'Tip:'}</strong>
                    <span>{property.type?.toUpperCase() || '-'}</span>
                  </div>
                  <div className="meta-item">
                    <strong>{language === 'en' ? 'District:' : language === 'ru' ? 'Район:' : 'Rayon:'}</strong>
                    <span>{t.districts?.[property.district] || property.district}</span>
                  </div>
                  <div className="meta-item">
                    <strong>{language === 'en' ? 'Price:' : language === 'ru' ? 'Цена:' : 'Qiymət:'}</strong>
                    <span>{property.price.daily} {property.price.currency} / {t.property.perNight}</span>
                  </div>
                  <div className="meta-item">
                    <strong>{language === 'en' ? 'Package:' : language === 'ru' ? 'Пакет:' : 'Paket:'}</strong>
                    <span style={{ 
                      color: property.listingTier === 'vip' ? '#9c27b0' : 
                             property.listingTier === 'premium' ? '#d4a574' : '#666',
                      fontWeight: 'bold'
                    }}>
                      {property.listingTier === 'vip' ? '👑 VIP' : 
                       property.listingTier === 'premium' ? '⭐ Premium' : 
                       property.listingTier?.toUpperCase() || 'Standard'}
                    </span>
                  </div>
                </div>

                <div className="review-section">
                  <h3>{language === 'en' ? 'Description' : language === 'ru' ? 'Описание' : 'Təsvir'}</h3>
                  <p>{getLocalizedText(property.description)}</p>
                </div>

                <div className="review-section">
                  <h3>{language === 'en' ? 'Owner Information' : language === 'ru' ? 'Информация владельца' : 'Sahib Məlumatı'}</h3>
                  <p><strong>Name:</strong> {property.owner?.name || '-'}</p>
                  <p><strong>Phone:</strong> {property.owner?.phone || '-'}</p>
                  <p><strong>Email:</strong> {property.owner?.email || '-'}</p>
                </div>

                {property.amenities && property.amenities.length > 0 && (
                  <div className="review-section">
                    <h3>{language === 'en' ? 'Amenities' : language === 'ru' ? 'Удобства' : 'Əlavə Xidmətlər'}</h3>
                    <div className="amenities-list">
                      {property.amenities.map(amenity => (
                        <span key={amenity} className="amenity-tag">{amenity}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </article>

            {/* Rejection Form */}
            {showRejectForm && (
              <article className="review-card rejection-form">
                <h3>{language === 'en' ? 'Reject Listing' : language === 'ru' ? 'Отклонить объявление' : 'Elanı Rədd Et'}</h3>
                <p className="form-hint">
                  {language === 'en' 
                    ? 'Enter a reason for rejection. This will be sent as a notification to the owner.'
                    : language === 'ru'
                    ? 'Укажите причину отказа. Владельцу будет отправлено уведомление.'
                    : 'Rədd səbəbini qeyd edin. Sahib bildirim alacaq.'}
                </p>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder={language === 'en' ? 'Rejection reason...' : language === 'ru' ? 'Причина отказа...' : 'Rədd səbəbi...'}
                  className="rejection-textarea"
                  rows={5}
                />
              </article>
            )}
          </div>

          {/* Action Buttons */}
          <div className="review-actions">
            {showRejectForm ? (
              <>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowRejectForm(false)
                    setRejectionReason('')
                  }}
                  disabled={isProcessing}
                >
                  {language === 'en' ? 'Cancel' : language === 'ru' ? 'Отмена' : 'Ləğv Et'}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleReject}
                  disabled={isProcessing}
                >
                  {isProcessing
                    ? t.messages.loading
                    : (language === 'en' ? 'Confirm Rejection' : language === 'ru' ? 'Подтвердить отклонение' : 'Rədd Etməyi Təsdiq Et')}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleCancel}
                  disabled={isProcessing}
                >
                  {language === 'en' ? 'Back' : language === 'ru' ? 'Назад' : 'Geri'}
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-outline"
                  onClick={() => setShowRejectForm(true)}
                  disabled={isProcessing}
                >
                  {language === 'en' ? 'Reject' : language === 'ru' ? 'Отклонить' : 'Rədd Et'}
                </button>
                <button
                  type="button"
                  className="btn btn-accent"
                  onClick={handleApprove}
                  disabled={isProcessing}
                >
                  {isProcessing
                    ? t.messages.loading
                    : (language === 'en' ? 'Approve' : language === 'ru' ? 'Одобрить' : 'Təsdiq Et')}
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </Layout>
  )
}
