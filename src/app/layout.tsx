import type {Metadata, Viewport} from 'next'
import {cookies} from 'next/headers'
import {routing, type AppLocale} from '@/messages/routing'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://birklik.az'),
  title: {default: 'Birklik.az', template: '%s | Birklik.az'},
  description: 'Azərbaycanda günlük kirayə evlər və istirahət məkanları',
  manifest: '/manifest.json',
  // OpenGraph раньше не выставлялся нигде, кроме картинки объявления. Ссылка на
  // сайт в WhatsApp, Telegram и Facebook разворачивалась в голый адрес без
  // названия и превью. Эти же теги читают сборщики данных для ИИ-поиска —
  // og:title с og:description для них зачастую единственное внятное описание
  // страницы. Разделы перекрывают их своими значениями, здесь только запасные.
  openGraph: {
    type: 'website',
    siteName: 'Birklik.az',
    title: 'Birklik.az',
    description: 'Azərbaycanda günlük kirayə evlər və istirahət məkanları',
    images: [{url: '/hero.jpeg', width: 1920, height: 1080, alt: 'Birklik.az'}]
  },
  twitter: {card: 'summary_large_image'},
  // .ico указан первым и с sizes: 'any' — его спрашивают старые браузеры,
  // почтовые клиенты и панель задач Windows, PNG им не подходит.
  icons: {
    icon: [
      {url: '/brand/favicon.ico', sizes: 'any'},
      {url: '/brand/generated/logo-32x32.png', type: 'image/png', sizes: '32x32'},
      {url: '/brand/generated/logo-16x16.png', type: 'image/png', sizes: '16x16'}
    ],
    apple: '/brand/generated/logo-180x180.png'
  }
}

export const viewport: Viewport = {width: 'device-width', initialScale: 1, themeColor: '#1a365d'}

/**
 * Здесь только каркас документа. Провайдеры, шапка и подвал переехали в
 * SiteShell, который подключают уже сами разделы, — корневой layout не может
 * знать язык из адреса: он родитель сегмента `[locale]` и рендерится раньше,
 * а без middleware Next не сообщает layout-у путь запроса.
 *
 * Атрибут lang остаётся здесь, потому что <html> бывает только в корне. Берём
 * его из куки — для нелокализованных страниц это и есть верный ответ, а на
 * `/ru/*` язык дополнительно объявлен через hreflang, и его же выставляет
 * клиент после гидратации.
 */
export default async function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  const cookieLocale = (await cookies()).get('NEXT_LOCALE')?.value
  const lang = routing.locales.includes(cookieLocale as AppLocale) ? cookieLocale : routing.defaultLocale

  return (
    <html lang={lang}>
      <body>{children}</body>
    </html>
  )
}
