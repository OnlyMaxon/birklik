'use client'

import {useEffect} from 'react'
import {useNavigate} from '@/lib/navigation'
import {useAuth} from '@/components/providers'

/**
 * Уводит на /dashboard тех, кто уже вошёл, — но по состоянию КЛИЕНТА, а не по
 * наличию куки на сервере.
 *
 * Раньше этим занимался серверный layout: `if (await getSession()) redirect(...)`.
 * Кука живёт 14 дней и переживает клиентскую сессию, и тогда получался капкан —
 * шапка показывает «Войти», клик уводит на /dashboard, где клиент никого не
 * знает. К форме входа было не пробиться, помогала только чистка данных сайта.
 *
 * Клиент здесь — источник истины не случайно: серверная кука выписывается из
 * клиентского idToken, то есть всегда вторична. Пока AuthProvider выясняет
 * состояние, форма просто отрисована — вход по ней и так требует ввода.
 */
export function RedirectIfAuthenticated() {
  const {isAuthenticated, isEmailVerified, isLoading} = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoading || !isAuthenticated) return
    // Неподтверждённую почту ведём сразу на подтверждение. Через /dashboard
    // получался лишний прыжок: тот всё равно отбрасывает туда же.
    navigate(isEmailVerified ? '/dashboard' : '/verify-email', {replace: true})
  }, [isAuthenticated, isEmailVerified, isLoading, navigate])

  return null
}
