import { az } from './az'
import { en } from './en'
import { ru } from './ru'
import { Language, Translations } from '../types'

export const translations: Record<Language, Translations> = {
  az,
  en,
  ru
}

export { az, en, ru }
