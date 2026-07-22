'use client'

import {useLanguage} from '@/components/providers'
import * as logger from '@/services/logger'
import type {LocalizedText} from '@/types'

interface ShareButtonProps {
  propertyId: string
  title: LocalizedText
}

export function ShareButton({propertyId, title}: ShareButtonProps) {
  const {language} = useLanguage()

  const handleShare = async () => {
    const propertyUrl = `${window.location.origin}/property/${propertyId}`
    const localizedTitle = title[language] || title.az || title.en || ''

    if (navigator.share) {
      try {
        await navigator.share({title: localizedTitle, text: `Check out this property: ${localizedTitle}`, url: propertyUrl})
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          logger.error('Error sharing:', error)
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(propertyUrl)
        alert(language === 'en' ? 'Link copied to clipboard!' : language === 'ru' ? 'Ссылка скопирована в буфер обмена!' : 'Keçid buferə kopyalandı!')
      } catch (error) {
        logger.error('Error copying to clipboard:', error)
        alert(language === 'en' ? 'Failed to copy link' : language === 'ru' ? 'Не удалось скопировать ссылку' : 'Keçidi kopyalamaq mümkün olmadı')
      }
    }
  }

  return (
    <button onClick={handleShare} className="pp-share-btn" title={language === 'en' ? 'Share' : language === 'ru' ? 'Поделиться' : 'Paylaş'} aria-label="Share">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
      </svg>
    </button>
  )
}
