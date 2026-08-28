import type {Metadata, Viewport} from 'next'
import {getLocale, getMessages} from 'next-intl/server'
import {Footer, Header, OfflineNotifier} from '@/components'
import {Providers} from './providers'
import {getCitiesWithListings} from './queries'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://birklik.az'),
  title: {default: 'Birklik.az', template: '%s | Birklik.az'},
  description: 'Azərbaycanda günlük kirayə evlər və istirahət məkanları',
  manifest: '/manifest.json',
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

// Ссылки на регионы в подвале нужны на каждой странице, иначе до посадочных
// страниц поисковик добирается только через карту сайта. Но подвал не повод
// ронять весь сайт: Firestore недоступен — рисуем без этого блока.
async function getFooterRegions() {
  try {
    return await getCitiesWithListings()
  } catch (error) {
    console.error('[layout] не удалось получить регионы для подвала:', error)
    return []
  }
}

export default async function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  const [locale, messages, regions] = await Promise.all([getLocale(), getMessages(), getFooterRegions()])
  return (
    <html lang={locale}>
      <body>
        <Providers locale={locale} messages={messages}>
          <div className="layout">
            <Header />
            <OfflineNotifier />
            <main className="main-content">{children}</main>
            <Footer regions={regions} />
          </div>
        </Providers>
      </body>
    </html>
  )
}
