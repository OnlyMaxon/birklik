import { az } from './az'
import { ru } from './ru'
import { en } from './en'
import { Language, Translations } from '../types'

export const translations: Record<Language, Translations> = {
  az,
  ru,
  en
}

export { az, ru, en }
