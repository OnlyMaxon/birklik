import type {Metadata} from 'next'
import {ContactPage} from './components/contact-page'
import {getAppTranslations} from '@/lib/i18n/get-app-translations'

export async function generateMetadata(): Promise<Metadata> {
  const {t} = await getAppTranslations()
  return {title: t.pages.contact.title}
}

export default function Page() { return <ContactPage /> }
