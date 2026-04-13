import React from 'react'
import { useLanguage, useAuth } from '../../context'
import { Property, Comment } from '../../types'
import { addCommentToProperty, deleteCommentFromProperty } from '../../services'
import { ReportCommentModal } from '../../components'
import * as logger from '../../services/logger'

interface PropertyCommentsProps {
  property: Property
  onCommentAdded?: () => void
}

/**
 * PropertyComments Component - Displays and manages property comments/reviews
 * @component
 * @param {PropertyCommentsProps} props - Component props
 * @returns {React.ReactElement} Rendered comments section
 * @example
 * <PropertyComments property={property} onCommentAdded={refresh} />
 */
export const PropertyComments: React.FC<PropertyCommentsProps> = ({ property, onCommentAdded }) => {
  const { language } = useLanguage()
  const { isAuthenticated, user } = useAuth()
  const [newComment, setNewComment] = React.useState('')
  const [isPostingComment, setIsPostingComment] = React.useState(false)
  const [replyingToId, setReplyingToId] = React.useState<string | null>(null)
  const [replyText, setReplyText] = React.useState('')
  const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [reportModal, setReportModal] = React.useState<{ isOpen: boolean; commentId: string; commentText: string } | null>(null)

  const handlePostComment = async () => {
    if (!isAuthenticated || !user || !newComment.trim()) return

    setIsPostingComment(true)
    try {
      await addCommentToProperty(property.id, user.id, user.name || 'Anonymous', user.avatar, newComment)
      setNewComment('')
      setMessage({ type: 'success', text: language === 'en' ? 'Comment posted!' : language === 'ru' ? 'Комментарий добавлен!' : 'Şərh əlavə edildi!' })
      onCommentAdded?.()
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({ type: 'error', text: language === 'en' ? 'Error posting comment' : language === 'ru' ? 'Ошибка при добавлении комментария' : 'Şərh əlavə edərkən xəta' })
      logger.error('Error posting comment:', error)
    } finally {
      setIsPostingComment(false)
    }
  }

  const handleDeleteComment = async (commentId: string, userId: string) => {
    if (user?.id !== userId) return

    try {
      await deleteCommentFromProperty(property.id, commentId)
      onCommentAdded?.()
    } catch (error) {
      logger.error('Error deleting comment:', error)
    }
  }

  const comments = property.comments || []

  return (
    <>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '1.5rem' }}>
          {language === 'en' ? 'Reviews' : language === 'ru' ? 'Отзывы' : 'Rəylər'} ({comments.length})
        </h2>

      {/* Comment Form */}
      {isAuthenticated && user ? (
        <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f8f9fa', borderRadius: '8px' }}>
          <textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder={language === 'en' ? 'Share your experience...' : language === 'ru' ? 'Поделитесь своим опытом...' : 'Öz təcrübənizi bölüşün...'}
            maxLength={500}
            style={{
              width: '100%',
              minHeight: '100px',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '0.95rem',
              fontFamily: 'inherit',
              marginBottom: '0.5rem',
              resize: 'vertical'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, color: '#999', fontSize: '0.85rem' }}>
              {newComment.length}/500
            </p>
            <button
              onClick={handlePostComment}
              disabled={!newComment.trim() || isPostingComment}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#27ae60',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: newComment.trim() ? 'pointer' : 'not-allowed',
                fontSize: '0.95rem',
                fontWeight: 500,
                opacity: newComment.trim() ? 1 : 0.6,
                transition: 'opacity 0.3s'
              }}
            >
              {isPostingComment ? '...' : language === 'en' ? 'Post' : language === 'ru' ? 'Отправить' : 'Göndər'}
            </button>
          </div>
        </div>
      ) : (
        <p style={{ color: '#999', marginBottom: '2rem' }}>
          {language === 'en' ? 'Sign in to leave a review' : language === 'ru' ? 'Войдите, чтобы оставить отзыв' : 'Rəy qoyması üçün daxil olun'}
        </p>
      )}

      {message && (
        <div style={{
          padding: '0.75rem 1rem',
          background: message.type === 'success' ? '#d4edda' : '#f8d7da',
          color: message.type === 'success' ? '#155724' : '#721c24',
          borderRadius: '6px',
          marginBottom: '1rem',
          fontSize: '0.9rem'
        }}>
          {message.text}
        </div>
      )}

      {/* Comments List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {comments.length === 0 ? (
          <p style={{ color: '#999', textAlign: 'center', padding: '2rem' }}>
            {language === 'en' ? 'No reviews yet' : language === 'ru' ? 'Отзывов пока нет' : 'Henüz rəy yoxdur'}
          </p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              style={{
                padding: '1rem',
                border: '1px solid #eee',
                borderRadius: '6px',
                background: '#fafafa'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {comment.userAvatar && (
                    <img
                      src={comment.userAvatar}
                      alt={comment.userName}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        objectFit: 'cover'
                      }}
                    />
                  )}
                  <div>
                    <p style={{ margin: '0 0 0.25rem 0', fontWeight: 600, fontSize: '0.95rem' }}>
                      {comment.userName}
                    </p>
                    <p style={{ margin: 0, color: '#999', fontSize: '0.85rem' }}>
                      {new Date(comment.createdAt).toLocaleDateString(language === 'en' ? 'en-GB' : language === 'ru' ? 'ru-RU' : 'az-Latn-AZ')}
                    </p>
                  </div>
                </div>
                {user?.id === comment.userId && (
                  <button
                    onClick={() => handleDeleteComment(comment.id, comment.userId)}
                    style={{
                      background: '#ffebee',
                      border: 'none',
                      color: '#d32f2f',
                      borderRadius: '4px',
                      padding: '0.25rem 0.75rem',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 500
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
              <p style={{ margin: '0 0 0.75rem 0', lineHeight: '1.5', color: '#333', whiteSpace: 'pre-wrap' }}>
                {comment.text}
              </p>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
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
                    textDecoration: 'underline'
                  }}
                >
                  {language === 'en' ? 'Reply' : language === 'ru' ? 'Ответить' : 'Cavab Ver'}
                </button>
                {isAuthenticated && user && (
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
                      textDecoration: 'underline'
                    }}
                  >
                    {language === 'en' ? 'Report' : language === 'ru' ? 'Пожаловаться' : 'Şikayyət'}
                  </button>
                )}
              </div>
              {replyingToId === comment.id && isAuthenticated && user && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #eee' }}>
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder={language === 'en' ? 'Your reply...' : language === 'ru' ? 'Ваш ответ...' : 'Cavabınız...'}
                    maxLength={250}
                    style={{
                      width: '100%',
                      minHeight: '60px',
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '0.9rem',
                      fontFamily: 'inherit',
                      marginBottom: '0.5rem',
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => { setReplyingToId(null); setReplyText('') }}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#f0f0f0',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                      }}
                    >
                      {language === 'en' ? 'Cancel' : language === 'ru' ? 'Отмена' : 'Ləğv Et'}
                    </button>
                    <button
                      onClick={async () => {
                        if (!replyText.trim()) return
                        const reply: Comment = {
                          id: `${Date.now()}_${user.id}`,
                          userId: user.id,
                          userName: user.name || 'Anonymous',
                          userAvatar: user.avatar,
                          text: replyText,
                          createdAt: new Date().toISOString(),
                          parentCommentId: comment.id
                        }
                        if (!comment.replies) comment.replies = []
                        comment.replies.push(reply)
                        setReplyText('')
                        setReplyingToId(null)
                        await addCommentToProperty(property.id, user.id, user.name || 'Anonymous', user.avatar, replyText)
                      }}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#27ae60',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                      }}
                    >
                      {language === 'en' ? 'Reply' : language === 'ru' ? 'Ответить' : 'Cavab Ver'}
                    </button>
                  </div>
                </div>
              )}
              {comment.replies && comment.replies.length > 0 && (
                <div style={{ marginTop: '1rem', paddingLeft: '1.5rem', borderLeft: '2px solid #eee' }}>
                  {comment.replies.map(reply => (
                    <div key={reply.id} style={{ marginBottom: '0.75rem', padding: '0.75rem', background: 'white', borderRadius: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        {reply.userAvatar && (
                          <img src={reply.userAvatar} alt={reply.userName} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                        )}
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>{reply.userName}</p>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#999' }}>
                          {new Date(reply.createdAt).toLocaleDateString()}
                        </p>
                        {user?.id === reply.userId && (
                          <button
                            onClick={() => handleDeleteComment(reply.id, reply.userId)}
                            style={{ background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>{reply.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>

    {/* Report Comment Modal */}
    {reportModal && (
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
    </>
  )
}
