'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import {useLocale, useMessages} from 'next-intl'
import {usePathname, useRouter} from 'next/navigation'
import {localizePath} from '@/lib/locale-routes'
import type {Language, Translations} from '@/types'

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
  const locale = useLocale() as Language
  const messages = useMessages() as {App: Translations}
  const router = useRouter()
  const pathname = usePathname()
  const [language, setLanguageState] = useState<Language>(locale)

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('language', lang)
    // Кука нужна по-прежнему: страницы объявлений и кабинета языка в адресе не
    // имеют, и выбор для них хранится только здесь.
    document.cookie = `NEXT_LOCALE=${lang}; path=/; max-age=31536000; samesite=lax`
    document.documentElement.lang = lang

    // А локализованные страницы обязаны сменить адрес: на /ru/about язык задан
    // сегментом, и одной куки мало — она бы не пересилила адрес. Заодно
    // получается ссылка, которой можно поделиться на нужном языке.
    const localized = localizePath(pathname, lang)
    if (localized !== pathname) {
      router.replace(`${localized}${window.location.search}${window.location.hash}`)
      return
    }
    router.refresh()
  }

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const t = messages.App

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider')
  }
  return context
}
