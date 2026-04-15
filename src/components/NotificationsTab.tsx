import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../context'
import { useAuth } from '../context'
import { Notification } from '../types'
import { getUserNotifications, markNotificationAsRead, deleteNotification } from '../services/notificationsService'
import { Loading } from './Loading'
import './TabsStyle.css'
import * as logger from '../services/logger'

export const NotificationsTab: React.FC = () => {
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
    await markNotificationAsRead(user.id, notificationId)
    setNotifications(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
    )
  }

  const handleDelete = async (notificationId: string) => {
    if (!user?.id) return
    await deleteNotification(user.id, notificationId)
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
  }

  const handleNotificationClick = async (notification: Notification) => {
    // Пометить как прочитанное при клике
    if (!notification.read && user?.id) {
      await markNotificationAsRead(user.id, notification.id)
      setNotifications(prev =>
        prev.map(n => (n.id === notification.id ? { ...n, read: true } : n))
      )
    }

    // Редирект в зависимости от типа уведомления
    const booking = notification as any
    const propertyId = booking.propertyId || notification.relatedId

    switch (notification.type) {
      case 'booking':
        // Перейти на вкладку бронирований в Dashboard
        navigate('/dashboard?tab=bookings')
        break

      case 'comment':
      case 'reply':
        // Перейти на страницу свойства где комментарий
        if (propertyId) {
          navigate(`/property/${propertyId}`)
        }
        break

      case 'favorite':
        // Перейти на страницу свойства которое добавили в избранное
        if (propertyId) {
          navigate(`/property/${propertyId}`)
        }
        break

      case 'rating':
        // Перейти на страницу свойства которое оценили
        if (propertyId) {
          navigate(`/property/${propertyId}`)
        }
        break

      case 'cancellationRequest':
        // Перейти на вкладку запросов отмены в Dashboard
        navigate('/dashboard?tab=cancellationRequests')
        break

      case 'cancellationApproved':
      case 'cancellationRejected':
        // Просто уведомление - никуда не редирект
        break

      case 'commentReport':
        // Перейти на вкладку отчетов в moderation page
        navigate('/dashboard/review?tab=reports')
        break

      default:
        break
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'booking':
        return '📅'
      case 'comment':
        return '💬'
      case 'favorite':
        return '❤️'
      case 'rating':
        return '⭐'
      case 'reply':
        return '↩️'
      case 'cancellationRequest':
        return '❌'
      case 'cancellationApproved':
        return '✅'
      case 'cancellationRejected':
        return '❌'
      case 'commentReport':
        return '🚩'
      default:
        return '🔔'
    }
  }

  if (isLoading) {
    return <Loading />
  }

  return (
    <div className="tab-content">
      <h3 className="tab-title">
        {language === 'en' ? 'Notifications' : language === 'ru' ? 'Уведомления' : 'Bildirişlər'}
      </h3>

      {notifications.length === 0 ? (
        <div className="empty-state">
          <p>{language === 'en' ? 'No notifications' : language === 'ru' ? 'Нет уведомлений' : 'Bildiriş yoxdur'}</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map(notification => (
            <div 
              key={notification.id} 
              className={`notification-item ${notification.read ? 'read' : 'unread'}`}
              onClick={() => handleNotificationClick(notification)}
              style={{ cursor: 'pointer' }}
            >
              <div className="notification-icon">{getNotificationIcon(notification.type)}</div>
              <div className="notification-content">
                <h4 className="notification-title">{notification.title}</h4>
                <p className="notification-message">{notification.message}</p>
                {notification.relatedUserName && (
                  <p className="notification-user">
                    {language === 'en' ? 'From' : language === 'ru' ? 'От' : 'Göndərən'}: <strong>{notification.relatedUserName}</strong>
                  </p>
                )}
                <p className="notification-time">
                  {new Date(notification.createdAt).toLocaleDateString(
                    language === 'en' ? 'en-GB' : language === 'ru' ? 'ru-RU' : 'az-AZ'
                  )}
                </p>
              </div>
              <div className="notification-actions" onClick={(e) => e.stopPropagation()}>
                {!notification.read && (
                  <button
                    onClick={() => handleMarkAsRead(notification.id)}
                    className="btn-mark-read"
                    title={language === 'en' ? 'Mark as read' : language === 'ru' ? 'Отметить как прочитанное' : 'Oxunduğu kimi işarələ'}
                  >
                    ✓
                  </button>
                )}
                <button
                  onClick={() => handleDelete(notification.id)}
                  className="btn-delete"
                  title={language === 'en' ? 'Delete' : language === 'ru' ? 'Удалить' : 'Sil'}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
