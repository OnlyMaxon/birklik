import type {Metadata} from 'next'
import {HomeBrowser} from './components/home-browser'
import {getTranslations} from 'next-intl/server'
import {getHomeProperties} from './queries'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('App')
  return {title: t('site.name')}
}

export default async function Page() {
  const {premium, standard} = await getHomeProperties()
  return (
    <HomeBrowser
      initialPremium={premium}
      initialStandard={standard.properties}
      initialCursor={standard.cursor}
    />
  )
}
