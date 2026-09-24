import type {Metadata} from 'next'
import {getAppTranslations} from '@/lib/i18n/get-app-translations'
import {localeAlternates, type LocaleCode} from '@/lib/locale-routes'
import {AccountDeletionForm} from './components/account-deletion-form'
import './account-deletion.css'

type PageProps = {params: Promise<{locale: string}>}

/**
 * Общедоступная страница удаления аккаунта.
 *
 * ⚠️ Существует не ради удобства, а потому что **Google требует её для выхода в
 * магазин**: у приложения с регистрацией должен быть и способ удалиться внутри
 * приложения, и отдельный веб-адрес, открывающийся БЕЗ установки. Этот адрес
 * вписывается в анкету «Безопасность данных» в Play Console.
 *
 * Отсюда два следствия для вёрстки:
 *
 * - страница открыта всем, в том числе не вошедшим: человек должен увидеть, что
 *   именно удаляется, ещё до входа;
 * - адрес постоянный и локализованный (`/account-deletion`, `/ru/...`,
 *   `/en/...`) — его нельзя переносить, он уже будет записан у Google.
 *
 * Язык берётся из `params`, а не из layout: рядом лежит `loading.tsx`, он
 * создаёт границу Suspense, страница считается отдельным проходом, и
 * `setRequestLocale` из layout до неё не доезжает.
 */
export async function generateMetadata({params}: PageProps): Promise<Metadata> {
  const {locale} = await params
  const {t} = await getAppTranslations(locale)
  const content = t.pages.accountDeletion

  return {
    title: content.title,
    description: content.intro,
    alternates: localeAlternates('/account-deletion', locale as LocaleCode)
  }
}

export default async function Page({params}: PageProps) {
  const {locale} = await params
  const {t} = await getAppTranslations(locale)
  const content = t.pages.accountDeletion

  return (
    <div className="account-deletion container">
      <header className="account-deletion__head">
        <h1>{content.title}</h1>
        <p className="account-deletion__intro">{content.intro}</p>
      </header>

      <section className="account-deletion__what">
        <h2>{content.whatTitle}</h2>
        <ul>
          {content.items.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="account-deletion__note">{content.bookingsNote}</p>
        <p className="account-deletion__note">{content.paymentsNote}</p>
      </section>

      <p className="account-deletion__warning" role="note">
        {content.warning}
      </p>

      {/* Сам вход и удаление — на клиенте: пароль подтверждает Firebase в
          браузере, а вызываемая функция берёт человека из его же токена. */}
      <AccountDeletionForm />

      <p className="account-deletion__contact">{content.contactNote}</p>
    </div>
  )
}
