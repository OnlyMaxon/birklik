'use client'

import React from 'react'
import {useParams, useNavigate} from '@/lib/navigation'
import {InlineSpinner, PropertyPageSkeleton} from '@/components'
import {useLanguage} from '@/components/providers'
import { getPropertyById, approveProperty, rejectProperty, updateProperty } from '@/services'
import { createListingRejectedNotification } from '@/services/notifications-service'
import { districtLabel } from '@/data'
import { Property, Language } from '@/types'

export const ModerationReview: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { language, t } = useLanguage()
  
  const [property, setProperty] = React.useState<Property | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [error, setError] = React.useState('')
  const [rejectionReason, setRejectionReason] = React.useState('')
  const [showRejectForm, setShowRejectForm] = React.useState(false)
  const [isEditMode, setIsEditMode] = React.useState(false)
  const [editedTitle, setEditedTitle] = React.useState('')
  const [editedDescription, setEditedDescription] = React.useState('')
  const [editedPrice, setEditedPrice] = React.useState(0)
  const [currentImageIndex, setCurrentImageIndex] = React.useState(0)

  // Image gallery navigation handlers
  const handlePrevImage = () => {
    if (property?.images && property.images.length > 0) {
      setCurrentImageIndex((prev) => (prev === 0 ? property.images.length - 1 : prev - 1))
    }
  }

  const handleNextImage = () => {
    if (property?.images && property.images.length > 0) {
      setCurrentImageIndex((prev) => (prev === property.images.length - 1 ? 0 : prev + 1))
    }
  }

  const goToImage = (index: number) => {
    setCurrentImageIndex(index)
  }

  // Reset image index when property changes
  React.useEffect(() => {
    setCurrentImageIndex(0)
  }, [id, property?.id])

  // Load property
  React.useEffect(() => {
    const loadProperty = async () => {
      if (!id) return

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
  }, [id, language])

  if (isLoading) {
    return <PropertyPageSkeleton />
  }

  if (!property || error) {
    return (
      <>
        <section className="property-page">
          <div className="container">
            <div className="error-message">{error}</div>
            <button className="btn btn-primary" onClick={() => navigate(-1)}>
              {language === 'en' ? 'Back' : language === 'ru' ? 'Назад' : 'Geri'}
            </button>
          </div>
        </section>
      </>
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
      // First, send rejection notification to property owner
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

      // Then, remove the property from moderation queue
      const rejected = await rejectProperty(property.id)
      if (!rejected) {
        setError(language === 'en' ? 'Could not reject listing.' : language === 'ru' ? 'Не удалось отклонить объявление.' : 'Elanı rədd etmək mümkün olmadı.')
        setIsProcessing(false)
        return
      }

      // Redirect back to moderation page
      navigate('/dashboard/review')
    } catch (err) {
      setError(language === 'en' ? 'Error rejecting listing' : language === 'ru' ? 'Ошибка при отклонении' : 'Elan rədd edilərkən xəta')
      setIsProcessing(false)
    }
  }

  const handleCancel = () => {
    navigate(-1)
  }

  const initializeEditMode = () => {
    setEditedTitle(property.title.az || property.title.en || '')
    setEditedDescription(property.description.az || property.description.en || '')
    setEditedPrice(property.price?.daily || 0)
    setIsEditMode(true)
    setError('')
  }

  const handleSaveAndApprove = async () => {
    setIsProcessing(true)
    setError('')

    try {
      // Update property with edited data
      const updated = await updateProperty(property.id, {
        title: { az: editedTitle, en: editedTitle, ru: editedTitle },
        description: { az: editedDescription, en: editedDescription, ru: editedDescription },
        price: {
          ...property.price,
          daily: editedPrice
        }
      })

      if (!updated) {
        setError(language === 'en' ? 'Could not update property.' : language === 'ru' ? 'Не удалось обновить объявление.' : 'Elanı yeniləmək mümkün olmadı.')
        setIsProcessing(false)
        return
      }

      // Approve the updated property
      const ok = await approveProperty(property.id)
      if (!ok) {
        setError(language === 'en' ? 'Could not approve listing.' : language === 'ru' ? 'Не удалось одобрить объявление.' : 'Elanı təsdiqləmək mümkün olmadı.')
        setIsProcessing(false)
        return
      }

      // Redirect to moderation page
      navigate('/dashboard/review')
    } catch (err) {
      setError(language === 'en' ? 'Error saving changes' : language === 'ru' ? 'Ошибка сохранения' : 'Dəyişikliklərin saxlanması xətası')
      setIsProcessing(false)
    }
  }

  return (
    <>
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
            {/* Edit Form */}
            {isEditMode && (
              <article className="review-card edit-form">
                <h3>{language === 'en' ? 'Edit Listing' : language === 'ru' ? 'Отредактировать объявление' : 'Elanı Redaktə Et'}</h3>
                
                <div className="form-section">
                  <label><strong>{language === 'en' ? 'Title:' : language === 'ru' ? 'Заголовок:' : 'Başlıq:'}</strong></label>
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-section">
                  <label><strong>{language === 'en' ? 'Description:' : language === 'ru' ? 'Описание:' : 'Təsvir:'}</strong></label>
                  <textarea
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    className="form-textarea"
                    rows={5}
                  />
                </div>

                <div className="form-section">
                  <label><strong>{language === 'en' ? 'Daily Price:' : language === 'ru' ? 'Дневная цена:' : 'Gündəlik Qiymət:'}</strong></label>
                  <input 
                    type="number"
                    value={editedPrice}
                    onChange={(e) => setEditedPrice(parseFloat(e.target.value) || 0)}
                    placeholder="Price per night"
                    className="form-input"
                    min="0"
                  />
                </div>
              </article>
            )}

            {/* Main Property Info */}
            <article className="review-card">
              <div className="review-image-section">
                {property.images && property.images.length > 0 ? (
                  <div className="mr-gallery-wrapper">
                    <div className="mr-gallery-main">
                      <img 
                        src={property.images[currentImageIndex] || 'https://via.placeholder.com/600x400?text=No+Image'} 
                        alt={`${getLocalizedText(property.title)} - ${currentImageIndex + 1}`} 
                        className="review-image"
                      />
                      {property.images.length > 1 && (
                        <>
                          <button 
                            className="mr-gallery-nav-btn mr-gallery-prev" 
                            onClick={handlePrevImage}
                            aria-label="Previous image"
                            title="Previous"
                          >
                            ‹
                          </button>
                          <button 
                            className="mr-gallery-nav-btn mr-gallery-next" 
                            onClick={handleNextImage}
                            aria-label="Next image"
                            title="Next"
                          >
                            ›
                          </button>
                          <div className="mr-gallery-counter">
                            {currentImageIndex + 1} / {property.images.length}
                          </div>
                        </>
                      )}
                    </div>
                    {property.images.length > 1 && (
                      <div className="mr-gallery-thumbnails">
                        {property.images.map((image, index) => (
                          <button
                            key={index}
                            className={`mr-gallery-thumbnail ${index === currentImageIndex ? 'active' : ''}`}
                            onClick={() => goToImage(index)}
                            title={`Image ${index + 1}`}
                            aria-label={`Go to image ${index + 1}`}
                          >
                            <img src={image} alt={`Thumbnail ${index + 1}`} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <img 
                    src="https://via.placeholder.com/600x400?text=No+Image" 
                    alt="No images available" 
                    className="review-image"
                  />
                )}
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
                    <span>{districtLabel(property.district, t)}</span>
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
                        <span key={amenity} className="amenity-tag">{t?.amenities?.[amenity] || amenity}</span>
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
            {isEditMode ? (
              <>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setIsEditMode(false)}
                  disabled={isProcessing}
                >
                  {language === 'en' ? 'Cancel' : language === 'ru' ? 'Отмена' : 'Ləğv Et'}
                </button>
                <button
                  type="button"
                  className="btn btn-accent"
                  onClick={handleSaveAndApprove}
                  disabled={isProcessing}
                  aria-busy={isProcessing}
                >
                  {isProcessing && <InlineSpinner label={t.messages.loading} />}
                  {isProcessing
                    ? t.messages.loading
                    : (language === 'en' ? 'Save & Approve' : language === 'ru' ? 'Сохранить и одобрить' : 'Saxla və Təsdiq Et')}
                </button>
              </>
            ) : showRejectForm ? (
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
                  aria-busy={isProcessing}
                >
                  {isProcessing && <InlineSpinner label={t.messages.loading} />}
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
                  className="btn btn-primary btn-outline"
                  onClick={initializeEditMode}
                  disabled={isProcessing}
                  title={language === 'en' ? 'Edit and fix issues in the listing' : language === 'ru' ? 'Отредактировать объявление' : 'Elanı redaktə et'}
                >
                  ✏️ {language === 'en' ? 'Edit' : language === 'ru' ? 'Редактировать' : 'Redaktə Et'}
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
                  aria-busy={isProcessing}
                >
                  {isProcessing && <InlineSpinner label={t.messages.loading} />}
                  {isProcessing
                    ? t.messages.loading
                    : (language === 'en' ? 'Approve' : language === 'ru' ? 'Одобрить' : 'Təsdiq Et')}
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
