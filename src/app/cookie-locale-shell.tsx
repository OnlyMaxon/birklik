import {getLocale, getMessages} from 'next-intl/server'
import {SiteShell} from './site-shell'

/**
 * Обвязка для разделов, у которых языка в адресе нет: объявление, кабинет,
 * вход, регистрация, подтверждение почты. Язык там берётся из куки, как и до
 * появления сегмента `[locale]`.
 *
 * Почему они не переехали под `[locale]`: у объявлений нет настоящих переводов
 * (владелец вводит текст один раз, во всех языках он одинаков), а кабинет,
 * вход и оплата закрыты в robots.txt — три языковых адреса им ни к чему.
 */
export async function CookieLocaleShell({children}: {children: React.ReactNode}) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()])
  return (
    <SiteShell locale={locale} messages={messages}>
      {children}
    </SiteShell>
  )
}
