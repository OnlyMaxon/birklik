import type {Metadata} from 'next'
import {HomeBrowser} from '../components/home-browser'
import {getTranslations} from 'next-intl/server'
import {getHomeProperties} from '../queries'
import {localeAlternates, type LocaleCode} from '@/lib/locale-routes'

export async function generateMetadata({
  params
}: {
  params: Promise<{locale: string}>
}): Promise<Metadata> {
  const [{locale}, t] = await Promise.all([params, getTranslations('App')])
  return {
    // Раньше здесь стояло site.name — заголовок выходил голым «Birklik.az», без
    // единого ключевого слова, тогда как на старой сборке он был описательным.
    // С шаблоном из layout получается «<описание> | Birklik.az».
    title: t('site.tagline'),
    alternates: localeAlternates('/', locale as LocaleCode)
  }
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
