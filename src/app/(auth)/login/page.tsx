import type {Metadata} from 'next'
import {LoginPage} from './components/login-page'
import {getAppTranslations} from '@/lib/i18n/get-app-translations'

export async function generateMetadata(): Promise<Metadata> {
  const {t} = await getAppTranslations()
  return {title: t.auth.login, robots: {index: false}}
}

export default function Page() { return <LoginPage /> }
