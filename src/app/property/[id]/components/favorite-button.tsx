'use client'

import React from 'react'
import {useLanguage} from '@/components/providers'
import {toggleFavoriteAction} from '../actions'

interface FavoriteButtonProps {
  propertyId: string
  initialIsFavorited: boolean
  isAuthenticated: boolean
}

export function FavoriteButton({propertyId, initialIsFavorited, isAuthenticated}: FavoriteButtonProps) {
  const {language} = useLanguage()
  const [isFavorited, setIsFavorited] = React.useState(initialIsFavorited)
  const [isPending, startTransition] = React.useTransition()

  const signInHint = language === 'en' ? 'Sign in to bookmark' : language === 'ru' ? 'Войдите чтобы добавить в закладки' : 'Bookmarklamaq üçün giriş yapın'

  const handleClick = () => {
    if (!isAuthenticated) {
      alert(signInHint)
      return
    }
    startTransition(async () => {
      const result = await toggleFavoriteAction(propertyId)
      if (result.success) setIsFavorited(result.isFavorited)
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`favorite-btn ${isFavorited ? 'favorited' : ''}`}
      title={!isAuthenticated ? signInHint : ''}
      aria-label="Add to bookmarks"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
      </svg>
    </button>
  )
}
