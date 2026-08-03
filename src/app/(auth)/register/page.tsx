import type {Metadata} from 'next'
import {RegistrationForm} from './components/registration-form'
import {getAppTranslations} from '@/lib/i18n/get-app-translations'

export async function generateMetadata(): Promise<Metadata> {
  const {t} = await getAppTranslations()
  return {title: t.auth.register, robots: {index: false}}
}

export default function Page() { return <RegistrationForm /> }
