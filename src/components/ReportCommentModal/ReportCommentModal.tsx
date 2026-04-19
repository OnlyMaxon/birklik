import React from 'react'
import { useLanguage } from '../../context'
import { ReportReason } from '../../types'
import { createCommentReport } from '../../services/reportService'
import { createReportNotification } from '../../services/notificationsService'
import * as logger from '../../services/logger'

interface ReportCommentModalProps {
  isOpen: boolean
  onClose: () => void
  propertyId: string
  commentId: string
  commentText: string
  reportedBy: string
  reportedByName: string
}

type ReportReasonKey = ReportReason

export const ReportCommentModal: React.FC<ReportCommentModalProps> = ({
  isOpen,
  onClose,
  propertyId,
  commentId,
  commentText,
  reportedBy,
  reportedByName
}) => {
  const { language, t } = useLanguage()
  const [reason, setReason] = React.useState<ReportReason>('spam')
  const [details, setDetails] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Get report reason labels from translations
  const getReasonLabel = (reasonKey: ReportReasonKey): string => {
    const reasonMap: { [key in ReportReasonKey]: string } = {
      spam: t.comments.spam,
      inappropriate: t.comments.inappropriate,
      offensive: t.comments.offensive,
      misleading: t.comments.misleading,
      other: t.comments.other
    }
    return reasonMap[reasonKey]
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!reason) {
      setMessage({
        type: 'error',
        text: language === 'en' ? 'Please select a reason' : language === 'ru' ? 'Пожалуйста, выберите причину' : 'Zəhmət olmasa səbəb seçin'
      })
      return
    }

    setIsSubmitting(true)
    
    try {
      // Create the report
      const report = await createCommentReport(
        propertyId,
        commentId,
        commentText,
        reportedBy,
        reportedByName,
        reason,
        details
      )

      // Check if report was created (null means duplicate)
      if (!report) {
        setMessage({
          type: 'error',
          text: language === 'en' 
            ? 'You have already reported this comment'
            : language === 'ru'
              ? 'Вы уже пожаловались на этот комментарий'
              : 'Siz artıq bu şərh haqqında şikayyət verdinisiniz'
        })
        setIsSubmitting(false)
        return
      }

      // Notify moderators
      try {
        const reasonText = getReasonLabel(reason as ReportReasonKey)
        
        await createReportNotification({
          type: 'commentReport',
          title: language === 'en' 
            ? 'New Comment Report' 
            : language === 'ru' 
              ? 'Новая жалоба на комментарий' 
              : 'Yeni şərh şikayyəti',
          message: language === 'en'
            ? `Report: ${reasonText}. Comment: "${commentText.substring(0, 50)}${commentText.length > 50 ? '...' : ''}"`
            : language === 'ru'
              ? `Жалоба: ${reasonText}. Комментарий: "${commentText.substring(0, 50)}${commentText.length > 50 ? '...' : ''}"`
              : `Şikayyət: ${reasonText}. Şərh: "${commentText.substring(0, 50)}${commentText.length > 50 ? '...' : ''}"`,
          reportId: report.id,
          propertyId,
          commentId,
          reason,
          reportedBy,
          relatedId: commentId,
          relatedUserId: reportedBy,
          relatedUserName: reportedByName
        } as any)
      } catch (notifError) {
        logger.error('Error creating notification:', notifError)
        // Don't fail the flow due to notification error
      }

      setMessage({
        type: 'success',
        text: language === 'en' 
          ? 'Report submitted successfully'
          : language === 'ru'
            ? 'Жалоба отправлена'
            : 'Şikayyət göndərildi'
      })

      // Reset form
      setReason('spam')
      setDetails('')

      // Close modal after 2 seconds
      setTimeout(() => {
        setMessage(null)
        onClose()
      }, 2000)
    } catch (error) {
      logger.error('Error submitting report:', error)
      setMessage({
        type: 'error',
        text: language === 'en' 
          ? 'Error submitting report'
          : language === 'ru'
            ? 'Ошибка при отправке жалобы'
            : 'Şikayyət göndərərkən xəta'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '2rem',
          maxWidth: '500px',
          width: '90%',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.2rem', fontWeight: 600 }}>
          {language === 'en' ? 'Report Comment' : language === 'ru' ? 'Пожаловаться на комментарий' : 'Şərh haqqında şikayyət'}
        </h2>

        {/* Comment Preview */}
        <div
          style={{
            background: '#f5f5f5',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            borderLeft: '3px solid #e74c3c'
          }}
        >
          <p style={{ margin: 0, color: '#555', fontSize: '0.9rem', fontStyle: 'italic' }}>
            {commentText.substring(0, 100)}{commentText.length > 100 ? '...' : ''}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Reason Select */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.95rem' }}>
              {language === 'en' ? 'Reason' : language === 'ru' ? 'Причина' : 'Səbəb'}
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '0.95rem',
                fontFamily: 'inherit',
                cursor: 'pointer'
              }}
            >
              {(['spam', 'inappropriate', 'offensive', 'misleading', 'other'] as ReportReason[]).map((reasonKey) => (
                <option key={reasonKey} value={reasonKey}>
                  {getReasonLabel(reasonKey)}
                </option>
              ))}
            </select>
          </div>

          {/* Details Textarea */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.95rem' }}>
              {language === 'en' ? 'Additional details (optional)' : language === 'ru' ? 'Дополнительные сведения (опционально)' : 'Əlavə detallar (istəyə bağlı)'}
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={500}
              placeholder={language === 'en' ? 'Please describe why you are reporting this comment...' : language === 'ru' ? 'Пожалуйста, объясните, почему вы жалуетесь на этот комментарий...' : 'Lütfən bu şərhi niyə bildirdiyinizi izah edin...'}
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '0.95rem',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
            <p style={{ margin: '0.5rem 0 0 0', color: '#999', fontSize: '0.85rem', textAlign: 'right' }}>
              {details.length}/500
            </p>
          </div>

          {/* Message */}
          {message && (
            <div
              style={{
                padding: '0.75rem 1rem',
                background: message.type === 'success' ? '#d4edda' : '#f8d7da',
                color: message.type === 'success' ? '#155724' : '#721c24',
                borderRadius: '6px',
                marginBottom: '1rem',
                fontSize: '0.9rem'
              }}
            >
              {message.text}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#f0f0f0',
                border: 'none',
                borderRadius: '6px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: '0.95rem',
                fontWeight: 500,
                opacity: isSubmitting ? 0.6 : 1
              }}
            >
              {language === 'en' ? 'Cancel' : language === 'ru' ? 'Отмена' : 'Ləğv et'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: '0.95rem',
                fontWeight: 500,
                opacity: isSubmitting ? 0.7 : 1
              }}
            >
              {isSubmitting 
                ? (language === 'en' ? 'Submitting...' : language === 'ru' ? 'Отправка...' : 'Göndərilir...')
                : (language === 'en' ? 'Submit Report' : language === 'ru' ? 'Отправить' : 'Şikayyəti göndər')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
