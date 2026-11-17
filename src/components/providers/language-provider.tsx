'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import {useLocale, useMessages} from 'next-intl'
import {usePathname, useRouter} from 'next/navigation'
import {localizePath} from '@/lib/locale-routes'
import type {Language, Translations} from '@birklik/core/types'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  /** Заранее подтянуть словарь языка, на который человек, похоже, сейчас перейдёт. */
  prefetchLanguage: (lang: Language) => void
  t: Translations
}

/**
 * Словарь другого языка — по требованию, из того же файла, что читает сервер.
 *
 * Путь относительный и с подстановкой, ровно как в `src/messages/request.ts`:
 * сборщику нужно видеть каталог, чтобы нарезать три языка тремя отдельными
 * куска́ми. Через имя пакета (`@birklik/core/messages/...`) он так не умеет.
 *
 * Куски ленивые: тому, кто язык не переключает, не достаётся ни байта.
 */
const loadDictionary = (lang: Language): Promise<Translations> =>
  import(`../../../core/src/messages/${lang}/app.json`).then(
    module => (module.default as {App: Translations}).App
  )

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
  /**
   * Словарь нового языка, пока сервер ещё отдаёт прежний.
   *
   * Зачем он нужен: `language` — состояние браузера и меняется мгновенно, а
   * `messages` приходят с сервера и доезжают только после `router.refresh()`.
   * Из-за этого подписи расходились по времени, и это было ВИДНО: «Главная»,
   * «Разместить», «Кабинет» и вкладка оплат в модераторке ещё секунду стояли
   * на старом языке, а соседние вкладки, собранные тернарником по `language`,
   * менялись сразу. Выглядело так, будто часть надписей захардкожена.
   *
   * Подмена снимается, как только сервер догонит: тогда словарь снова один.
   */
  const [pendingDictionary, setPendingDictionary] = useState<{lang: Language; t: Translations} | null>(null)

  const prefetchLanguage = useCallback((lang: Language) => {
    // Второй вызов бесплатен: кусок уже в кэше модулей.
    void loadDictionary(lang).catch(() => {})
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    // Свой словарь подставляем сразу, не дожидаясь сервера. Отказ глотаем
    // молча: это ускорение, а не единственный путь — сервер всё равно
    // пришлёт переводы следующим ответом.
    loadDictionary(lang)
      .then(dictionary => setPendingDictionary({lang, t: dictionary}))
      .catch(() => {})
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

  // Сервер догнал — подмена больше не нужна, второй словарь можно отпустить.
  useEffect(() => {
    if (pendingDictionary && locale === pendingDictionary.lang) setPendingDictionary(null)
  }, [locale, pendingDictionary])

  // Условие именно на `language`: если человек успел переключиться дважды,
  // подставлять словарь от предыдущего нажатия нельзя.
  const t = pendingDictionary?.lang === language ? pendingDictionary.t : messages.App

  return (
    <LanguageContext.Provider value={{ language, setLanguage, prefetchLanguage, t }}>
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
