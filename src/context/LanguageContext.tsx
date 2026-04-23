import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Language, Translations } from '../types'
import { translations } from '../i18n'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: Translations
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

interface LanguageProviderProps {
  children: ReactNode
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language')
    if (saved === 'en' || saved === 'ru' || saved === 'az') return saved
    return 'az'
  })

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('language', lang)
    document.documentElement.lang = lang
  }

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const t = translations[language] || translations['en'] || {}

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext)
  if (!context) {
    // Fallback: return default translations if context not available
    return {
      language: 'az',
      setLanguage: () => {},
      t: translations['az'] || translations['en'] || {}
    }
  }
  return context
}
