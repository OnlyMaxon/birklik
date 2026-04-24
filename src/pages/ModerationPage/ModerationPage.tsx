import React from 'react'
import { Navigate, useSearchParams, Link } from 'react-router-dom'
import { Layout } from '../../layouts'
import { Loading } from '../../components'
import { useAuth, useLanguage } from '../../context'
import { getPendingProperties, deleteCommentFromProperty, getAllCommentsForModeration, CommentWithProperty, getAllProperties, deleteProperty, rejectProperty } from '../../services'
import { createListingRejectedNotification } from '../../services/notificationsService'
import { getAllReports, closeReport } from '../../services/reportService'
import { isModerator } from '../../config/constants'
import { Language, Property, CommentReport } from '../../types'
import './ModerationPage.css'

type ModerationTab = 'posts' | 'comments' | 'reports' | 'allListings'

export const ModerationPage: React.FC = () => {
  const { isAuthenticated, firebaseUser } = useAuth()
  const { language, t } = useLanguage()
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as ModerationTab | null
  const [activeTab, setActiveTab] = React.useState<ModerationTab>(tabParam || 'posts')
  const [pendingListings, setPendingListings] = React.useState<Property[]>([])
  const [allComments, setAllComments] = React.useState<CommentWithProperty[]>([])
  const [allReports, setAllReports] = React.useState<CommentReport[]>([])
  const [allListings, setAllListings] = React.useState<Property[]>([])
  const [searchQuery, setSearchQuery] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(true)
  const [isDeletingComment, setIsDeletingComment] = React.useState<string | null>(null)
  const [isClosingReport, setIsClosingReport] = React.useState<string | null>(null)
  const [isDeletingListing, setIsDeletingListing] = React.useState<string | null>(null)
  const [isModeratorUser, setIsModeratorUser] = React.useState(false)
  const [tokenLoaded, setTokenLoaded] = React.useState(false)
  const [error, setError] = React.useState('')
  const [showRejectModal, setShowRejectModal] = React.useState(false)
  const [selectedPropertyForReject, setSelectedPropertyForReject] = React.useState<Property | null>(null)
  const [rejectReason, setRejectReason] = React.useState('')
  const [isRejectingProperty, setIsRejectingProperty] = React.useState(false)

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

  // Sync activeTab with URL search params
  React.useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam)
    }
  }, [tabParam])

  const loadPendingListings = React.useCallback(async () => {
    setIsLoading(true)
    setError('')
    const [listings, comments, reports, allProps] = await Promise.all([
      getPendingProperties(),
      getAllCommentsForModeration(),
      getAllReports(),
      getAllProperties()
    ])
    setPendingListings(listings)
    setAllComments(comments)
    setAllReports(reports)
    setAllListings(allProps)
    setIsLoading(false)
  }, [])

  React.useEffect(() => {
    if (tokenLoaded && isModeratorUser) {
      loadPendingListings()
    }
  }, [tokenLoaded, isModeratorUser, loadPendingListings])

  if (!tokenLoaded) {
    return <Loading fullScreen message="Loading..." brand />
  }

  if (!isAuthenticated || !isModeratorUser) {
    return <Navigate to="/dashboard" replace />
  }

  const deleteComment = async (propertyId: string, commentId: string) => {
    setIsDeletingComment(commentId)
    setError('')

    const ok = await deleteCommentFromProperty(propertyId, commentId)
    if (!ok) {
      setError(language === 'en' ? 'Could not delete comment.' : language === 'ru' ? 'Не удалось удалить комментарий.' : 'Şərhi silmək mümkün olmadı.')
      setIsDeletingComment(null)
      return
    }

    await loadPendingListings()
    setIsDeletingComment(null)
  }

  const handleCloseReport = async (reportId: string, commentDeleted: boolean) => {
    setIsClosingReport(reportId)
    setError('')

    const ok = await closeReport(reportId, commentDeleted)
    if (!ok) {
      setError(language === 'en' ? 'Could not close report.' : language === 'ru' ? 'Не удалось закрыть жалобу.' : 'Şikayyəti bağlamaq mümkün olmadı.')
      setIsClosingReport(null)
      return
    }

    await loadPendingListings()
    setIsClosingReport(null)
  }

  const deleteListing = async (id: string) => {
    setIsDeletingListing(id)
    setError('')

    const ok = await deleteProperty(id)
    if (!ok) {
      setError(language === 'en' ? 'Could not delete listing.' : language === 'ru' ? 'Не удалось удалить объявление.' : 'Elanı silmək mümkün olmadı.')
      setIsDeletingListing(null)
      return
    }

    await loadPendingListings()
    setIsDeletingListing(null)
  }

  const handleRejectPropertyClick = (property: Property) => {
    setSelectedPropertyForReject(property)
    setShowRejectModal(true)
    setRejectReason('')
    setError('')
  }

  const handleConfirmRejectProperty = async () => {
    if (!selectedPropertyForReject || !rejectReason.trim()) {
      setError(language === 'en' ? 'Please provide a rejection reason' : language === 'ru' ? 'Укажите причину отказа' : 'Rədd səbəbini qeyd edin')
      return
    }

    setIsRejectingProperty(true)
    setError('')

    try {
      // Send rejection notification to owner
      if (selectedPropertyForReject.ownerId) {
        await createListingRejectedNotification(selectedPropertyForReject.ownerId, {
          type: 'listingRejected',
          title: language === 'en' ? 'Listing Rejected' : language === 'ru' ? 'Объявление отклонено' : 'Elan rədd edildi',
          message: language === 'en' 
            ? `Your listing has been rejected: ${rejectReason}`
            : language === 'ru'
            ? `Ваше объявление было отклонено: ${rejectReason}`
            : `Elanınız rədd edildi: ${rejectReason}`,
          read: false,
          propertyId: selectedPropertyForReject.id,
          propertyTitle: getLocalizedText(selectedPropertyForReject.title),
          rejectionReason: rejectReason
        })
      }

      // Remove property from moderation queue
      const rejected = await rejectProperty(selectedPropertyForReject.id)
      if (!rejected) {
        setError(language === 'en' ? 'Could not reject listing.' : language === 'ru' ? 'Не удалось отклонить объявление.' : 'Elanı rədd etmək mümkün olmadı.')
        setIsRejectingProperty(false)
        return
      }

      // Close modal and refresh list
      setShowRejectModal(false)
      setSelectedPropertyForReject(null)
      setRejectReason('')
      await loadPendingListings()
    } catch (err) {
      setError(language === 'en' ? 'Error rejecting listing' : language === 'ru' ? 'Ошибка при отклонении' : 'Elan rədd edilərkən xəta')
      setIsRejectingProperty(false)
    }
  }

  const getLocalizedText = (text: Partial<Record<Language, string>>) => text[language] || text.az || text.en || ''

  return (
    <Layout>
      <section className="moderation-page">
        <div className="container moderation-layout">
          <div className="moderation-content-wrapper">
            <div className="moderation-header">
              <h1>{language === 'en' ? 'Moderation' : language === 'ru' ? 'Модерация' : 'Moderasiya'}</h1>
              <p>{language === 'en' ? 'Review pending listings and comments.' : language === 'ru' ? 'Проверьте ожидающие объявления и комментарии.' : 'Gözləyən elanları və şərhləri yoxlayın.'}</p>
            </div>

            {/* Tabs */}
          <div className="moderation-tabs">
            <button
              className={`tab-btn ${activeTab === 'posts' ? 'active' : ''}`}
              onClick={() => setActiveTab('posts')}
            >
              {language === 'en' ? 'Listings' : language === 'ru' ? 'Объявления' : 'Elanlar'} ({pendingListings.length})
            </button>
            <button
              className={`tab-btn ${activeTab === 'comments' ? 'active' : ''}`}
              onClick={() => setActiveTab('comments')}
            >
              {language === 'en' ? 'Comments' : language === 'ru' ? 'Комментарии' : 'Şərhlər'} ({allComments.length})
            </button>
            <button
              className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('reports')}
            >
              {language === 'en' ? 'Reports' : language === 'ru' ? 'Жалобы' : 'Şikayətlər'} ({allReports.filter(r => r.status === 'open').length})
            </button>
            <button
              className={`tab-btn ${activeTab === 'allListings' ? 'active' : ''}`}
              onClick={() => setActiveTab('allListings')}
            >
              {language === 'en' ? 'All Listings' : language === 'ru' ? 'Все объявления' : 'Bütün Elanlar'} ({allListings.length})
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}

          {isLoading ? (
            <Loading message={t.messages.loading} />
          ) : activeTab === 'posts' ? (
            // POSTS TAB
            pendingListings.length === 0 ? (
              <div className="moderation-empty card">
                <p>{language === 'en' ? 'No pending listings right now.' : language === 'ru' ? 'Сейчас нет объявлений в ожидании.' : 'Hazırda gözləyən elan yoxdur.'}</p>
              </div>
            ) : (
              <div className="moderation-list">
                {pendingListings.map((listing) => (
                  <article key={listing.id} className="moderation-item card">
                    <img src={listing.images?.[0] || 'https://via.placeholder.com/400x300?text=No+Image'} alt={getLocalizedText(listing.title)} className="moderation-image" />

                    <div className="moderation-content">
                      <h3>{getLocalizedText(listing.title)}</h3>
                      <p className="moderation-meta">{listing.price.daily} {listing.price.currency} / {t.property.perNight} · {t.districts[listing.district]}</p>
                      <p className="moderation-description">{getLocalizedText(listing.description)}</p>
                      <p className="moderation-owner">
                        <strong>{language === 'en' ? 'Owner:' : language === 'ru' ? 'Владелец:' : 'Sahib:'}</strong> {listing.owner?.name || '-'} · {listing.owner?.phone || '-'}
                      </p>
                      <p className="moderation-owner">
                        <strong>{language === 'en' ? 'Plan:' : language === 'ru' ? 'Тариф:' : 'Paket:'}</strong> 
                        {listing.listingTier === 'vip' ? (
                          <span style={{ color: '#9c27b0', fontWeight: 'bold', marginLeft: '0.5rem' }}>
                            👑 VIP
                          </span>
                        ) : listing.listingTier === 'premium' ? (
                          <span style={{ color: '#d4a574', fontWeight: 'bold', marginLeft: '0.5rem' }}>
                            ⭐ Premium
                          </span>
                        ) : (
                          <span style={{ color: '#666', marginLeft: '0.5rem' }}>{(listing.listingTier || 'standard').toUpperCase()}</span>
                        )}
                      </p>
                    </div>

                    <div className="moderation-actions">
                      <Link to={`/dashboard/review/${listing.id}`} className="btn btn-ghost btn-sm">
                        {language === 'en' ? 'Review' : language === 'ru' ? 'Проверить' : 'Bax'}
                      </Link>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleRejectPropertyClick(listing)}
                      >
                        {language === 'en' ? 'Reject' : language === 'ru' ? 'Отклонить' : 'Rədd Et'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                      >
                        {language === 'en' ? 'Send Invoice' : language === 'ru' ? 'Счёт' : 'Faktura'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : activeTab === 'comments' ? (
            // COMMENTS TAB
            allComments.length === 0 ? (
              <div className="moderation-empty card">
                <p>{language === 'en' ? 'No comments to moderate.' : language === 'ru' ? 'Нет комментариев для модерации.' : 'Moderasiya üçün şərh yoxdur.'}</p>
              </div>
            ) : (
              <div className="moderation-list">
                {allComments.map((item) => (
                  <article key={`${item.propertyId}-${item.comment.id}`} className="moderation-comment card">
                    <div className="comment-header">
                      <strong>{item.comment.userName}</strong>
                      <span className="comment-date">
                        {new Date(item.comment.createdAt).toLocaleDateString(language === 'en' ? 'en-GB' : language === 'ru' ? 'ru-RU' : 'az-Latn-AZ')}
                      </span>
                    </div>
                    
                    <div className="comment-property">
                      <span className="property-label">
                        {language === 'en' ? 'On property:' : language === 'ru' ? 'На объявление:' : 'Elan üzrə:'}
                      </span>
                      <Link to={`/property/${item.propertyId}`} className="property-link">
                        {item.propertyTitle}
                      </Link>
                    </div>

                    <p className="comment-text">{item.comment.text}</p>

                    <div className="moderation-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => deleteComment(item.propertyId, item.comment.id)}
                        disabled={isDeletingComment === item.comment.id}
                      >
                        {isDeletingComment === item.comment.id
                          ? t.messages.loading
                          : (language === 'en' ? 'Delete' : language === 'ru' ? 'Удалить' : 'Sil')}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : activeTab === 'reports' ? (
            // REPORTS TAB
            allReports.length === 0 ? (
              <div className="moderation-empty card">
                <p>{language === 'en' ? 'No comment reports.' : language === 'ru' ? 'Нет жалоб на комментарии.' : 'Şərhlər haqqında şikayyət yoxdur.'}</p>
              </div>
            ) : (
              <div className="moderation-list">
                {allReports.map((report) => (
                  <article key={report.id} className="moderation-comment card">
                    <div style={{ padding: '1rem', borderRadius: '8px', background: report.status === 'open' ? '#fff3e0' : '#f5f5f5', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <strong>
                          {language === 'en' ? 'Report' : language === 'ru' ? 'Жалоба' : 'Şikayyət'} #{report.id.slice(0, 8)}
                        </strong>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          fontWeight: 500,
                          background: report.status === 'open' ? '#ff9800' : '#4caf50',
                          color: 'white'
                        }}>
                          {report.status === 'open' 
                            ? (language === 'en' ? 'Open' : language === 'ru' ? 'Открыто' : 'Açıq')
                            : (language === 'en' ? 'Closed' : language === 'ru' ? 'Закрыто' : 'Tertibli')}
                        </span>
                      </div>
                      <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: '#666' }}>
                        <strong>{language === 'en' ? 'Reason:' : language === 'ru' ? 'Причина:' : 'Səbəb:'}</strong> {report.reason}
                      </p>
                      <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: '#666' }}>
                        <strong>{language === 'en' ? 'Reported by:' : language === 'ru' ? 'Пожаловался:' : 'Bildirən:'}</strong> {report.reportedByName}
                      </p>
                      {report.details && (
                        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#555', fontStyle: 'italic' }}>
                          <strong>{language === 'en' ? 'Details:' : language === 'ru' ? 'Детали:' : 'Detallar:'}</strong> {report.details}
                        </p>
                      )}
                    </div>

                    <div style={{ padding: '1rem', background: '#f9f9f9', borderRadius: '8px', borderLeft: '3px solid #e74c3c', marginBottom: '1rem' }}>
                      <p style={{ margin: 0, fontSize: '0.95rem', color: '#333', fontStyle: 'italic' }}>
                        "{report.commentText.substring(0, 150)}{report.commentText.length > 150 ? '...' : ''}"
                      </p>
                    </div>

                    {report.status === 'open' && (
                      <div className="moderation-actions">
                        <Link to={`/property/${report.propertyId}#comment-${report.commentId}`} className="btn btn-ghost btn-sm">
                          {language === 'en' ? 'View Comment' : language === 'ru' ? 'Просмотр' : 'Şərhi görüş'}
                        </Link>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={async () => {
                            await deleteComment(report.propertyId, report.commentId)
                            await handleCloseReport(report.id, true)
                          }}
                          disabled={isDeletingComment === report.commentId || isClosingReport === report.id}
                        >
                          {isDeletingComment === report.commentId || isClosingReport === report.id
                            ? t.messages.loading
                            : (language === 'en' ? 'Delete & Close' : language === 'ru' ? 'Удалить' : 'Sil')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-accent btn-sm"
                          style={{ background: '#4caf50' }}
                          onClick={() => handleCloseReport(report.id, false)}
                          disabled={isClosingReport === report.id}
                        >
                          {isClosingReport === report.id
                            ? t.messages.loading
                            : (language === 'en' ? 'Dismiss' : language === 'ru' ? 'Отклонить' : 'Rədd et')}
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )
          ) : activeTab === 'allListings' ? (
            // ALL LISTINGS TAB
            <div>
              <div style={{ marginBottom: '1.5rem' }}>
                <input
                  type="text"
                  placeholder={language === 'en' ? 'Search listings...' : language === 'ru' ? 'Поиск объявлений...' : 'Elanları axtarın...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #ddd',
                    fontSize: '0.95rem'
                  }}
                />
              </div>

              {allListings.length === 0 ? (
                <div className="moderation-empty card">
                  <p>{language === 'en' ? 'No listings found.' : language === 'ru' ? 'Объявлений не найдено.' : 'Elan tapılmadı.'}</p>
                </div>
              ) : (
                <div className="moderation-list">
                  {allListings
                    .filter(listing => {
                      const query = searchQuery.toLowerCase()
                      const title = getLocalizedText(listing.title).toLowerCase()
                      const description = getLocalizedText(listing.description).toLowerCase()
                      const owner = listing.owner?.name.toLowerCase() || ''
                      return title.includes(query) || description.includes(query) || owner.includes(query)
                    })
                    .map((listing) => (
                      <article key={listing.id} className="moderation-item card">
                        <img src={listing.images?.[0] || 'https://via.placeholder.com/400x300?text=No+Image'} alt={getLocalizedText(listing.title)} className="moderation-image" />

                        <div className="moderation-content">
                          <h3>{getLocalizedText(listing.title)}</h3>
                          <p className="moderation-meta">{listing.price.daily} {listing.price.currency} / {t.property.perNight} · {t.districts[listing.district]}</p>
                          <p className="moderation-description">{getLocalizedText(listing.description)}</p>
                          <p className="moderation-owner">
                            <strong>{language === 'en' ? 'Owner:' : language === 'ru' ? 'Владелец:' : 'Sahib:'}</strong> {listing.owner?.name || '-'} · {listing.owner?.phone || '-'}
                          </p>
                          <p className="moderation-owner">
                            <strong>{language === 'en' ? 'Status:' : language === 'ru' ? 'Статус:' : 'Status:'}</strong> {listing.isActive ? (language === 'en' ? 'Published' : language === 'ru' ? 'Опубликовано' : 'Dərc olunub') : (language === 'en' ? 'Archived' : language === 'ru' ? 'Архивировано' : 'Arxivləşdirildi')}
                          </p>
                        </div>

                        <div className="moderation-actions">
                          <Link to={`/property/${listing.id}`} className="btn btn-ghost btn-sm">
                            {language === 'en' ? 'View' : language === 'ru' ? 'Просмотр' : 'Bax'}
                          </Link>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            style={{ background: '#e74c3c' }}
                            onClick={() => {
                              if (confirm(language === 'en' ? 'Delete this listing?' : language === 'ru' ? 'Удалить объявление?' : 'Bu elanı silmək istəyirsiniz?')) {
                                deleteListing(listing.id)
                              }
                            }}
                            disabled={isDeletingListing === listing.id}
                          >
                            {isDeletingListing === listing.id
                              ? t.messages.loading
                              : (language === 'en' ? 'Delete' : language === 'ru' ? 'Удалить' : 'Sil')}
                          </button>
                        </div>
                      </article>
                    ))}
                </div>
              )}
            </div>
          ) : null
          }
          </div>
        </div>

        {/* Rejection Modal */}
        {showRejectModal && selectedPropertyForReject && (
          <div className="moderation-overlay" onClick={() => !isRejectingProperty && setShowRejectModal(false)}>
            <div className="moderation-modal" onClick={(e) => e.stopPropagation()}>
              <h2>{language === 'en' ? 'Reject Listing' : language === 'ru' ? 'Отклонить объявление' : 'Elanı Rədd Et'}</h2>
              
              {error && <div className="error-message">{error}</div>}
              
              <p className="rejection-title">{getLocalizedText(selectedPropertyForReject.title)}</p>
              
              <label>{language === 'en' ? 'Rejection Reason:' : language === 'ru' ? 'Причина отказа:' : 'Rədd səbəbi:'}</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={language === 'en' ? 'Enter rejection reason...' : language === 'ru' ? 'Укажите причину отказа...' : 'Rədd səbəbini qeyd edin...'}
                className="rejection-textarea"
                rows={5}
                disabled={isRejectingProperty}
              />
              
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => !isRejectingProperty && setShowRejectModal(false)}
                  disabled={isRejectingProperty}
                >
                  {language === 'en' ? 'Cancel' : language === 'ru' ? 'Отмена' : 'Ləğv Et'}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleConfirmRejectProperty}
                  disabled={isRejectingProperty || !rejectReason.trim()}
                >
                  {isRejectingProperty ? t.messages.loading : (language === 'en' ? 'Reject' : language === 'ru' ? 'Отклонить' : 'Rədd Et')}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </Layout>
  )
}
