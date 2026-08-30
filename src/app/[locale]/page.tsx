import type {Metadata} from 'next'
import {HomeBrowser} from '../components/home-browser'
import {getTranslations} from 'next-intl/server'
import {getHomeProperties} from '../queries'
import {localeAlternates, localizePath, type LocaleCode} from '@/lib/locale-routes'
import {openGraphFor} from '@/lib/seo'

export async function generateMetadata({
  params
}: {
  params: Promise<{locale: string}>
}): Promise<Metadata> {
  const [{locale}, t] = await Promise.all([params, getTranslations('App')])
  const title = t('site.tagline')
  const description = t('site.description')
  return {
    // Раньше здесь стояло site.name — заголовок выходил голым «Birklik.az», без
    // единого ключевого слова, тогда как на старой сборке он был описательным.
    // С шаблоном из layout получается «<описание> | Birklik.az».
    title,
    // Описание тоже своё на каждый язык. Без него сюда подставлялось
    // азербайджанское из корневого layout — и в русской выдаче сниппет
    // главной был на азербайджанском.
    description,
    alternates: localeAlternates('/', locale as LocaleCode),
    openGraph: openGraphFor({
      title,
      description,
      path: localizePath('/', locale as LocaleCode),
      locale
    })
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
