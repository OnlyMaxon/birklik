import type {Metadata} from 'next'
import {AboutPage} from './components/about-page'
import {getAppTranslations} from '@/lib/i18n/get-app-translations'

export async function generateMetadata(): Promise<Metadata> {
  const {t} = await getAppTranslations()
  return {title: t.pages.about.title}
}

export default function Page() { return <AboutPage /> }
