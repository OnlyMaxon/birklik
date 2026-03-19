import { az } from './az'
import { en } from './en'
import { Language, Translations } from '../types'

export const translations: Record<Language, Translations> = {
  az,
  en
}

export { az, en }
