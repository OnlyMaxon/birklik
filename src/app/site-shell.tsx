import type {ComponentProps} from 'react'
import {Footer, Header, OfflineNotifier} from '@/components'
import {getCitiesWithListings} from './queries'
import {Providers} from './providers'

type ProviderMessages = ComponentProps<typeof Providers>['messages']

/**
 * Общая обвязка страницы: провайдеры, шапка, подвал.
 *
 * Вынесена из корневого layout, потому что язык у разных разделов берётся
 * по-разному. Корневой layout — родитель сегмента `[locale]`, он рендерится
 * раньше и о выбранном в адресе языке знать не может: без middleware Next не
 * сообщает layout-у путь запроса. Пока обвязка жила там, `/ru/about` отдавал
 * азербайджанский текст — язык успевал определиться по куке до того, как
 * сегмент его задавал.
 *
 * Теперь язык приходит снаружи: из сегмента адреса для локализованных страниц
 * и из куки для остальных (объявление, кабинет, вход).
 */
export async function SiteShell({
  locale,
  messages,
  children
}: {
  locale: string
  messages: ProviderMessages
  children: React.ReactNode
}) {
  // Ссылки на регионы нужны на каждой странице, иначе до посадочных страниц
  // поисковик добирается только через карту сайта. Но подвал не повод ронять
  // сайт: Firestore недоступен — рисуем без этого блока.
  let regions: Awaited<ReturnType<typeof getCitiesWithListings>> = []
  try {
    regions = await getCitiesWithListings()
  } catch (error) {
    console.error('[shell] не удалось получить регионы для подвала:', error)
  }

  return (
    <Providers locale={locale} messages={messages}>
      <div className="layout">
        <Header />
        <OfflineNotifier />
        <main className="main-content">{children}</main>
        <Footer regions={regions} />
      </div>
    </Providers>
  )
}
