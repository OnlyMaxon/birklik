import {notFound} from 'next/navigation'
import {getMessages, setRequestLocale} from 'next-intl/server'
import {SiteShell} from '../site-shell'
import {routing, type AppLocale} from '@/messages/routing'

/**
 * Закрепляет язык для всего поддерева по сегменту адреса.
 *
 * Сюда переехали только страницы с настоящим переводом: главная, разделы
 * регионов и информационные. Страницы объявлений намеренно остались снаружи —
 * их текст владельцы вводят один раз, и во всех трёх языках он одинаков, так
 * что три адреса дали бы дубликат. Личный кабинет, вход и оплата закрыты в
 * robots.txt, локаль в адресе им не нужна.
 *
 * Адреса без префикса (`/about`) попадают сюда через rewrites в next.config —
 * снаружи они прежние, внутри превращаются в `/az/about`. Так азербайджанская
 * версия сохранила все проиндексированные адреса.
 */
export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{locale: string}>
}) {
  const {locale} = await params
  if (!routing.locales.includes(locale as AppLocale)) notFound()

  // Обязательно ДО getMessages: иначе next-intl возьмёт язык из куки, и
  // `/ru/` показал бы азербайджанский тому, кто раньше выбирал азербайджанский,
  // а для поисковика все три адреса отдавали бы одно и то же.
  setRequestLocale(locale)

  return (
    <SiteShell locale={locale} messages={await getMessages()}>
      {children}
    </SiteShell>
  )
}
