import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../context'
import { useAuth } from '../context'
import { Notification } from '../types'
import { getUserNotifications, deleteNotification } from '../services/notificationsService'
import { Loading } from './Loading'
import './TabsStyle.css'
import * as logger from '../services/logger'

export const NotificationsTab = React.memo(() => {
  const navigate = useNavigate()
  const { t, language } = useLanguage()
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
    // Delete notification instead of marking as read - auto-cleanup after viewing
    await deleteNotification(user.id, notificationId)
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
  }

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return
    
    const unreadNotifications = notifications.filter(n => !n.read)
    
    // Delete all unread notifications - auto-cleanup
    for (const notification of unreadNotifications) {
      await deleteNotification(user.id, notification.id)
    }
    
    // Update state - remove deleted notifications
    setNotifications(prev => prev.filter(n => n.read))
  }

  const handleDelete = async (notificationId: string) => {
    if (!user?.id) return
    await deleteNotification(user.id, notificationId)
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
  }

  const handleNotificationClick = async (notification: Notification) => {
    // Delete notification when clicked (auto-cleanup after viewing/interacting)
    if (user?.id) {
      await deleteNotification(user.id, notification.id)
      setNotifications(prev => prev.filter(n => n.id !== notification.id))
    }

    // Редирект в зависимости от типа уведомления
    const booking = notification as unknown as Record<string, unknown>
    const propertyId = (booking?.propertyId as string) || notification.relatedId

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 className="tab-title">
          {language === 'en' ? 'Notifications' : language === 'ru' ? 'Уведомления' : 'Bildirişlər'}
        </h3>
        {notifications.some(n => !n.read) && (
          <button
            onClick={handleMarkAllAsRead}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              transition: 'background-color 0.3s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#229954' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#27ae60' }}
          >
            {t.buttons.markAllAsRead}
          </button>
        )}
      </div>

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
})
