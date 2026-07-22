import 'server-only'
import {getLocale, getMessages} from 'next-intl/server'
import type {Language, Translations} from '@/types'

export async function getAppTranslations() {
  const language = (await getLocale()) as Language
  const messages = (await getMessages()) as {App: Translations}
  return {language, t: messages.App}
}
