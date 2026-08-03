'use client'

import React from 'react'
import {useLanguage} from '@/components/providers'
import {InlineSpinner} from '@/components'
import {sanitizeInput} from '@/utils/sanitization'
import type {Comment} from '@/types'
import {addCommentAction, deleteCommentAction, addReplyAction} from '../actions'
import {ReportCommentModal} from './report-comment-modal'

interface CommentsSectionProps {
  propertyId: string
  initialComments: Comment[]
  currentUserId: string | null
  isAuthenticated: boolean
}

export function CommentsSection({propertyId, initialComments, currentUserId, isAuthenticated}: CommentsSectionProps) {
  const {language, t} = useLanguage()
  const [comments, setComments] = React.useState(initialComments)
  const [newComment, setNewComment] = React.useState('')
  const [isPostingComment, setIsPostingComment] = React.useState(false)
  const [replyingToId, setReplyingToId] = React.useState<string | null>(null)
  const [replyText, setReplyText] = React.useState('')
  const [isPostingReply, setIsPostingReply] = React.useState(false)
  const [reportModal, setReportModal] = React.useState<{isOpen: boolean; commentId: string; commentText: string} | null>(null)

  const formatDate = (value?: string) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : language === 'ru' ? 'ru-RU' : 'az-Latn-AZ').format(date)
  }

  const handleAddComment = async () => {
    if (!isAuthenticated || !newComment.trim()) return

    setIsPostingComment(true)
    const result = await addCommentAction(propertyId, newComment.trim())
    if (result.success) {
      setComments(prev => [...prev, result.comment])
      setNewComment('')
    }
    setIsPostingComment(false)
  }

  const handleDeleteComment = async (commentId: string) => {
    const result = await deleteCommentAction(propertyId, commentId)
    if (result.success) {
      setComments(prev => prev.filter(c => c.id !== commentId))
    }
  }

  const handleAddReply = async (parentCommentId: string) => {
    if (!isAuthenticated || !replyText.trim()) return

    setIsPostingReply(true)
    const result = await addReplyAction(propertyId, parentCommentId, replyText.trim())
    if (result.success) {
      setComments(prev => prev.map(c => c.id === parentCommentId ? {...c, replies: [...(c.replies || []), result.reply]} : c))
      setReplyText('')
      setReplyingToId(null)
    }
    setIsPostingReply(false)
  }

  return (
    <div className="interactions-comments">
      <h4>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        {t.property.comments} ({comments.length})
      </h4>

      {isAuthenticated ? (
        <div className="comments-input-area">
          <input
            type="text"
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder={t.property.addComment}
            onKeyPress={e => e.key === 'Enter' && handleAddComment()}
          />
          <button onClick={handleAddComment} disabled={isPostingComment || !newComment.trim()} className="btn btn-sm btn-primary" aria-busy={isPostingComment}>
            {isPostingComment && <InlineSpinner label={t.messages.loading} />}{t.property.post}
          </button>
        </div>
      ) : (
        <p className="comments-sign-in-hint">{t.property.signInComment}</p>
      )}

      <div className="comments-list">
        {comments.length > 0 ? (
          comments.map(comment => (
            <div key={comment.id} className="comment-item">
              <div className="comment-header">
                <span className="comment-author">{comment.userName}</span>
                {currentUserId === comment.userId && (
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
                  <button onClick={() => setReportModal({isOpen: true, commentId: comment.id, commentText: comment.text})} className="pp-comment-action-btn pp-comment-action-btn--report">
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
                      onChange={e => setReplyText(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && handleAddReply(comment.id)}
                      placeholder={language === 'en' ? 'Write a reply...' : language === 'ru' ? 'Написать ответ...' : 'Cavab yazın...'}
                    />
                    <button onClick={() => handleAddReply(comment.id)} disabled={isPostingReply || !replyText.trim()} className="pp-reply-submit-btn" aria-busy={isPostingReply}>
                      {isPostingReply && <InlineSpinner label={t.messages.loading} />}{language === 'en' ? 'Reply' : language === 'ru' ? 'Ответить' : 'Cavab Ver'}
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

      {reportModal && (
        <ReportCommentModal
          isOpen={reportModal.isOpen}
          onClose={() => setReportModal(null)}
          propertyId={propertyId}
          commentId={reportModal.commentId}
          commentText={reportModal.commentText}
        />
      )}
    </div>
  )
}
