import {CookieLocaleShell} from '../cookie-locale-shell'
import {RedirectIfAuthenticated} from './components/redirect-if-authenticated'

// Серверного редиректа здесь намеренно нет. Он проверял только куку, а она
// переживает клиентскую сессию на срок до 14 дней — и человек с устаревшей
// кукой не мог попасть на форму входа вовсе: /login уводил на /dashboard,
// где клиент его не знал. Теперь решение принимает клиент, который про свою
// сессию знает точно, а устаревшую куку AuthProvider тут же гасит.
export default function AuthLayout({children}: {children: React.ReactNode}) {
  return (
    <CookieLocaleShell>
      <RedirectIfAuthenticated />
      {children}
    </CookieLocaleShell>
  )
}
