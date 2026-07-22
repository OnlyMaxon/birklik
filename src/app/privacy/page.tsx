import type {Metadata} from 'next'
import {PrivacyPage} from './components/privacy-page'
import {getAppTranslations} from '@/lib/i18n/get-app-translations'

export async function generateMetadata(): Promise<Metadata> {
  const {t} = await getAppTranslations()
  return {title: t.pages.privacy.title}
}

export default function Page() { return <PrivacyPage /> }
