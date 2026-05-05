import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../context'
import { useAuth } from '../context'
import { Notification, NotificationType } from '../types'
import { getUserNotifications, deleteNotification } from '../services/notificationsService'
import { Loading } from './Loading'
import './TabsStyle.css'
import * as logger from '../services/logger'

const formatRelativeTime = (dateStr: string, language: string): string => {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (mins < 1) return language === 'en' ? 'Just now' : language === 'ru' ? 'Только что' : 'İndicə'
  if (mins < 60) return language === 'en' ? `${mins}m ago` : language === 'ru' ? `${mins} мин назад` : `${mins} dəq əvvəl`
  if (hours < 24) return language === 'en' ? `${hours}h ago` : language === 'ru' ? `${hours} ч назад` : `${hours} saat əvvəl`
  if (days < 7) return language === 'en' ? `${days}d ago` : language === 'ru' ? `${days} дн назад` : `${days} gün əvvəl`
  return new Date(dateStr).toLocaleDateString(language === 'en' ? 'en-GB' : language === 'ru' ? 'ru-RU' : 'az-AZ')
}

const NtfIcon = ({ type }: { type: NotificationType }) => {
  const { color, svg } = getIconMeta(type)
  return (
    <div className={`ntf-icon ntf-icon--${color}`}>
      {svg}
    </div>
  )
}

const getIconMeta = (type: NotificationType): { color: string; svg: React.ReactNode } => {
  switch (type) {
    case 'booking':
      return {
        color: 'blue',
        svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      }
    case 'bookingApproved':
    case 'cancellationApproved':
      return {
        color: 'green',
        svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      }
    case 'bookingRejected':
    case 'cancellationRejected':
    case 'listingRejected':
      return {
        color: 'red',
        svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      }
    case 'comment':
      return {
        color: 'green',
        svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      }
    case 'reply':
      return {
        color: 'blue',
        svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
      }
    case 'favorite':
      return {
        color: 'rose',
        svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      }
    case 'rating':
      return {
        color: 'amber',
        svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      }
    case 'cancellationRequest':
      return {
        color: 'amber',
        svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      }
    case 'commentReport':
      return {
        color: 'red',
        svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
      }
    case 'premium':
      return {
        color: 'purple',
        svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
      }
    case 'invoiceSent':
      return {
        color: 'amber',
        svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      }
    default:
      return {
        color: 'gray',
        svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      }
  }
}

export const NotificationsTab = React.memo(() => {
  const navigate = useNavigate()
  const { language } = useLanguage()
  const { user } = useAuth()
  const [notifications, setNotifications] = React.useState<Notification[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    const loadNotifications = async () => {
      if (!user?.id) return
      setIsLoading(true)
      try {
        const data = await getUserNotifications(user.id)
        setNotifications(data)
      } catch (error) {
        logger.error('Error loading notifications:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadNotifications()
  }, [user?.id])

  const handleMarkAsRead = async (notificationId: string) => {
    if (!user?.id) return
    await deleteNotification(user.id, notificationId)
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
  }

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return
    const unread = notifications.filter(n => !n.read)
    for (const n of unread) {
      await deleteNotification(user.id, n.id)
    }
    setNotifications(prev => prev.filter(n => n.read))
  }

  const handleDelete = async (notificationId: string) => {
    if (!user?.id) return
    await deleteNotification(user.id, notificationId)
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (user?.id) {
      await deleteNotification(user.id, notification.id)
      setNotifications(prev => prev.filter(n => n.id !== notification.id))
    }

    const booking = notification as unknown as Record<string, unknown>
    const propertyId = (booking?.propertyId as string) || notification.relatedId

    switch (notification.type) {
      case 'booking':
      case 'cancellationRequest':
        navigate('/dashboard?tab=bookings&subtab=requests')
        break
      case 'cancellationApproved':
      case 'cancellationRejected':
        navigate('/dashboard?tab=bookings&subtab=requests')
        break
      case 'comment':
      case 'reply':
      case 'favorite':
      case 'rating':
        if (propertyId) navigate(`/property/${propertyId}`)
        break
      case 'commentReport':
        navigate('/dashboard/review?tab=reports')
        break
      default:
        break
    }
  }

  if (isLoading) return <Loading />

  const unreadCount = notifications.filter(n => !n.read).length

  const title = language === 'en' ? 'Notifications' : language === 'ru' ? 'Уведомления' : 'Bildirişlər'
  const markAllLabel = language === 'en' ? 'Mark all read' : language === 'ru' ? 'Всё прочитано' : 'Hamısını oxu'
  const fromLabel = language === 'en' ? 'From' : language === 'ru' ? 'От' : 'Göndərən'
  const markReadTitle = language === 'en' ? 'Mark as read' : language === 'ru' ? 'Отметить прочитанным' : 'Oxundu kimi işarələ'
  const deleteTitle = language === 'en' ? 'Delete' : language === 'ru' ? 'Удалить' : 'Sil'
  const emptyText = language === 'en' ? 'No notifications yet' : language === 'ru' ? 'Уведомлений нет' : 'Bildiriş yoxdur'

  return (
    <div className="tab-content">
      <div className="ntf-header">
        <h3 className="ntf-header-title">
          {title}
          {unreadCount > 0 && <span className="ntf-unread-badge">{unreadCount}</span>}
        </h3>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllAsRead} className="ntf-mark-all-btn">
            {markAllLabel}
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="ntf-empty">
          <div className="ntf-empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <p className="ntf-empty-text">{emptyText}</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map(notification => (
            <div
              key={notification.id}
              className={[
                'notification-item',
                notification.read ? 'read' : 'unread',
                `type-${notification.type}`
              ].join(' ')}
              onClick={() => handleNotificationClick(notification)}
            >
              {!notification.read && <span className="ntf-dot" />}
              <NtfIcon type={notification.type} />
              <div className="notification-content">
                <p className="notification-title">{notification.title}</p>
                <p className="notification-message">{notification.message}</p>
                <div className="notification-meta">
                  {notification.relatedUserName && (
                    <>
                      <span className="notification-user">{fromLabel}: {notification.relatedUserName}</span>
                      <span className="ntf-sep">·</span>
                    </>
                  )}
                  <span className="notification-time">{formatRelativeTime(notification.createdAt, language)}</span>
                </div>
              </div>
              <div className="notification-actions" onClick={e => e.stopPropagation()}>
                {!notification.read && (
                  <button onClick={() => handleMarkAsRead(notification.id)} className="btn-mark-read" title={markReadTitle}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>
                )}
                <button onClick={() => handleDelete(notification.id)} className="btn-delete" title={deleteTitle}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})
