'use client'

import React from 'react'
import {useLanguage} from '@/components/providers'
import {InlineSpinner} from '@/components'
import {addRatingAction} from '../actions'

interface RatingWidgetProps {
  propertyId: string
  averageRating?: number
  reviewCount?: number
  initialUserRating: number | null
  hasBooked: boolean
  isAuthenticated: boolean
}

export function RatingWidget({propertyId, averageRating, reviewCount, initialUserRating, hasBooked, isAuthenticated}: RatingWidgetProps) {
  const {t} = useLanguage()
  const [userRating, setUserRating] = React.useState(initialUserRating)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleRating = async (rating: number) => {
    if (!isAuthenticated) {
      alert(t.property.signInRate)
      return
    }
    if (!hasBooked) {
      alert(t.property.onlyRateBooked)
      return
    }

    setIsSubmitting(true)
    const result = await addRatingAction(propertyId, rating)

    if (result.success) {
      setUserRating(rating)
    } else if (result.error === 'not-booked') {
      alert(t.property.onlyRateBooked)
    } else {
      alert(t.messages.ratingError)
    }

    setIsSubmitting(false)
  }

  return (
    <div className="interactions-rating">
      <h4>{t.property.rateProperty} {isSubmitting && <InlineSpinner label={t.messages.loading} />}</h4>
      <div className="average-rating">
        <span className="rating-value">{averageRating && averageRating > 0 ? averageRating.toFixed(1) : '-'}</span>
        <span className="rating-text">
          {averageRating && averageRating > 0
            ? `(${reviewCount || 0} ${t.property.reviewCount})`
            : t.property.notRated}
        </span>
      </div>
      <div className="stars-rating">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            className={`star-btn ${userRating === star ? 'active' : ''} ${userRating && star <= userRating ? 'filled' : ''}`}
            onClick={() => handleRating(star)}
            // Гостю звёзды остаются кликабельными: обработчик подскажет, что нужно
            // войти. Раньше кнопки были disabled, и эта подсказка была недостижима —
            // человек просто жал в никуда.
            disabled={isSubmitting}
            title={`${star} ${t.property.star}`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  )
}
