import {redirect} from 'next/navigation'
import {getSession} from '@/lib/auth/session'
import {CookieLocaleShell} from '../cookie-locale-shell'

export default async function DashboardLayout({children}: {children: React.ReactNode}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.emailVerified) redirect('/verify-email')
  // Обвязка подключается здесь, а не в корневом layout: язык кабинета берётся
  // из куки, тогда как у страниц под [locale] он задан адресом.
  return <CookieLocaleShell>{children}</CookieLocaleShell>
}
