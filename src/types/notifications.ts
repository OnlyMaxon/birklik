/**
 * Notification Type - User notifications for bookings, comments, favorites, replies, premium
 */

export type NotificationType = 'booking' | 'comment' | 'favorite' | 'reply' | 'premium' | 'commentReport'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  read: boolean
  createdAt: string
  relatedId?: string // propertyId, commentId, etc.
  relatedUserId?: string
  relatedUserName?: string
  actionUrl?: string
}

export interface BookingNotification extends Notification {
  type: 'booking'
  propertyId: string
  bookingId: string
  bookerName: string
  bookerEmail: string
  bookerPhone: string
  checkInDate: string
  checkOutDate: string
}

export interface CommentNotification extends Notification {
  type: 'comment'
  propertyId: string
  commentId: string
  commenterName: string
  commentText: string
}

export interface FavoriteNotification extends Notification {
  type: 'favorite'
  propertyId: string
  favoriterName: string
}

export interface ReplyNotification extends Notification {
  type: 'reply'
  propertyId: string
  commentId: string
  parentCommentId: string
  replierName: string
  replyText: string
}

export interface PremiumNotification extends Notification {
  type: 'premium'
  propertyId: string
  propertyTitle: string
  action: 'expired' | 'expiring_soon'
}

export interface ReportNotification extends Notification {
  type: 'commentReport'
  reportId: string
  propertyId: string
  commentId: string
  reason: string
  reportedBy: string
}
