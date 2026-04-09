import React from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Layout } from '../../layouts'
import { Loading } from '../../components'
import { useAuth, useLanguage } from '../../context'
import { approveProperty, getPendingProperties, deleteCommentFromProperty, getAllCommentsForModeration, CommentWithProperty } from '../../services'
import { isModerator } from '../../config/constants'
import { Language, Property } from '../../types'
import './ModerationPage.css'

type ModerationTab = 'posts' | 'comments'

export const ModerationPage: React.FC = () => {
  const { isAuthenticated, firebaseUser } = useAuth()
  const { language, t } = useLanguage()
  const [activeTab, setActiveTab] = React.useState<ModerationTab>('posts')
  const [pendingListings, setPendingListings] = React.useState<Property[]>([])
  const [allComments, setAllComments] = React.useState<CommentWithProperty[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isApprovingId, setIsApprovingId] = React.useState<string | null>(null)
  const [isDeletingComment, setIsDeletingComment] = React.useState<string | null>(null)
  const [isModeratorUser, setIsModeratorUser] = React.useState(false)
  const [tokenLoaded, setTokenLoaded] = React.useState(false)
  const [error, setError] = React.useState('')

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

  const loadPendingListings = React.useCallback(async () => {
    setIsLoading(true)
    setError('')
    const [listings, comments] = await Promise.all([
      getPendingProperties(),
      getAllCommentsForModeration()
    ])
    setPendingListings(listings)
    setAllComments(comments)
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

  const approveListing = async (id: string) => {
    setIsApprovingId(id)
    setError('')

    const ok = await approveProperty(id)
    if (!ok) {
      setError(language === 'en' ? 'Could not approve listing.' : language === 'ru' ? 'Не удалось одобрить объявление.' : 'Elanı təsdiqləmək mümkün olmadı.')
      setIsApprovingId(null)
      return
    }

    await loadPendingListings()
    setIsApprovingId(null)
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

  const getLocalizedText = (text: Partial<Record<Language, string>>) => text[language] || text.az || text.en || ''

  return (
    <Layout>
      <section className="moderation-page">
        <div className="container moderation-container">
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
                        <strong>{language === 'en' ? 'Plan:' : language === 'ru' ? 'Тариф:' : 'Paket:'}</strong> {(listing.listingTier || 'standard').toUpperCase()}
                      </p>
                    </div>

                    <div className="moderation-actions">
                      <Link to={`/property/${listing.id}`} className="btn btn-ghost btn-sm">
                        {language === 'en' ? 'Preview' : language === 'ru' ? 'Предпросмотр' : 'Önizləmə'}
                      </Link>
                      <button
                        type="button"
                        className="btn btn-accent btn-sm"
                        onClick={() => approveListing(listing.id)}
                        disabled={isApprovingId === listing.id}
                      >
                        {isApprovingId === listing.id
                          ? t.messages.loading
                          : (language === 'en' ? 'Approve' : language === 'ru' ? 'Одобрить' : 'Təsdiq et')}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : (
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
          )}
        </div>
      </section>
    </Layout>
  )
}
