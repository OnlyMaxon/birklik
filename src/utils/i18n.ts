import { Language } from '../types'

export const getLocalizedText = (
  en: string,
  az: string,
  ru: string,
  language: Language
): string => {
  switch (language) {
    case 'en':
      return en
    case 'ru':
      return ru
    default:
      return az
  }
}

export const isLanguage = (language: Language, ...langs: Language[]): boolean => {
  return langs.includes(language)
}
