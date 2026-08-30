import type {ComponentProps} from 'react'
import {Footer, Header, OfflineNotifier} from '@/components'
import {getCitiesWithListings} from './queries'
import {getSessionUser} from '@/lib/auth/session-user'
import {Providers} from './providers'
import {SiteJsonLd} from './site-json-ld'

type ProviderMessages = ComponentProps<typeof Providers>['messages']

/**
 * Отсекает от переводов раздел `pages` перед отправкой в браузер.
 *
 * Там лежат тексты «О нас», правил, политики и пользовательского соглашения —
 * 17 КБ, почти половина всего словаря. Уезжали они на КАЖДОЙ странице, хотя
 * читают их только пять серверных страниц, каждая свою. Клиентским компонентам
 * раздел не нужен ни одному — проверено по всему `src`.
 *
 * Серверная сторона не задета: `getAppTranslations` берёт словарь из
 * `getMessages()` напрямую, минуя провайдер, и видит его целиком.
 */
function withoutServerOnlyMessages(messages: ProviderMessages): ProviderMessages {
  const app = messages.App
  if (!app || typeof app !== 'object' || Array.isArray(app)) return messages
  const {pages: _serverOnly, ...rest} = app as Record<string, unknown>
  return {...messages, App: rest as ProviderMessages[string]}
}

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
  // Оба запроса параллельно: подвалу нужны регионы, шапке — вошедший. Ни один
  // из них не повод ронять страницу, поэтому у каждого свой запасной ответ.
  const [regions, sessionUser] = await Promise.all([
    getCitiesWithListings().catch(error => {
      console.error('[shell] не удалось получить регионы для подвала:', error)
      return [] as Awaited<ReturnType<typeof getCitiesWithListings>>
    }),
    // Гость за это не платит: без сессионной куки запрос никуда не уходит.
    getSessionUser().catch(error => {
      console.error('[shell] не удалось определить вошедшего:', error)
      return null
    })
  ])

  return (
    <Providers
      locale={locale}
      messages={withoutServerOnlyMessages(messages)}
      initialUser={sessionUser?.user ?? null}
      initialEmailVerified={sessionUser?.emailVerified ?? false}
    >
      {/* Разметка организации — на каждой странице: она описывает площадку, а
          не конкретный экран. */}
      <SiteJsonLd />
      <div className="layout">
        <Header />
        <OfflineNotifier />
        <main className="main-content">{children}</main>
        <Footer regions={regions} />
      </div>
    </Providers>
  )
}
