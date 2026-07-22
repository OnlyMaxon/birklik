import type {Metadata} from 'next'
import {UserAgreementPage} from './components/user-agreement-page'
import {getAppTranslations} from '@/lib/i18n/get-app-translations'

export async function generateMetadata(): Promise<Metadata> {
  const {t} = await getAppTranslations()
  return {title: t.pages.userAgreement.title}
}

export default function Page() { return <UserAgreementPage /> }
