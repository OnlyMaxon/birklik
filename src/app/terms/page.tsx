import type {Metadata} from 'next'
import {TermsPage} from './components/terms-page'
import {getAppTranslations} from '@/lib/i18n/get-app-translations'

export async function generateMetadata(): Promise<Metadata> {
  const {t} = await getAppTranslations()
  return {title: t.pages.terms.title}
}

export default function Page() { return <TermsPage /> }
