import type {Metadata, Viewport} from 'next'
import {getLocale, getMessages} from 'next-intl/server'
import {Footer, Header, OfflineNotifier} from '@/components'
import {Providers} from './providers'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://birklik.az'),
  title: {default: 'Birklik.az', template: '%s | Birklik.az'},
  description: 'Azərbaycanda günlük kirayə evlər və istirahət məkanları',
  manifest: '/manifest.json',
  icons: {icon: '/brand/generated/logo-32x32.png', apple: '/brand/generated/logo-180x180.png'}
}

export const viewport: Viewport = {width: 'device-width', initialScale: 1, themeColor: '#1a365d'}

export default async function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()])
  return (
    <html lang={locale}>
      <body>
        <Providers locale={locale} messages={messages}>
          <div className="layout">
            <Header />
            <OfflineNotifier />
            <main className="main-content">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  )
}
