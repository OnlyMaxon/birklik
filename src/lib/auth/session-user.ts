import 'server-only'
import {getDoc} from '@/lib/firebase/firestore-rest'
import {toImageApiUrl} from '@/lib/images'
import {getSession} from './session'
import type {User} from '@birklik/core/types'

/**
 * Кто вошёл — по данным сервера, ещё до того как в браузере оживёт Firebase.
 *
 * Нужно, чтобы шапка не мигала. Клиентский SDK восстанавливает сессию из
 * IndexedDB асинхронно, поэтому первым кадром страница рисовалась гостем, а
 * через мгновение — аккаунтом. Сервер знает ответ сразу: сессионная кука у него
 * уже есть.
 *
 * Гость не платит за это ничего: getSession без куки возвращает null, не ходя
 * никуда. Обращение к Firestore случается только для вошедших.
 */
export interface SessionUser {
  user: User
  /** Подтверждена ли почта — по куке, чтобы не гонять новичка через дашборд. */
  emailVerified: boolean
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getSession()
  if (!session) return null

  // ⚠️ Здесь строился адрес заглушки с ui-avatars.com, и в нём ехало настоящее
  // имя человека — на чужой сервер, при каждой отрисовке. Пустой аватар значит
  // «нет аватара», инициалы рисует сам интерфейс.
  const fallbackName = session.email?.split('@')[0] || 'User'

  try {
    const profile = await getDoc<{name?: string; phone?: string; avatar?: string}>(
      'users',
      session.uid
    )
    const name = profile?.name || fallbackName
    return {
      emailVerified: session.emailVerified,
      user: {
        id: session.uid,
        name,
        email: session.email ?? '',
        phone: profile?.phone ?? '',
        avatar: toImageApiUrl(profile?.avatar || '') || ''
      }
    }
  } catch (error) {
    // Профиль не прочитался — это не повод показывать человека гостем и уж тем
    // более ронять страницу. Отдаём то, что известно из самой куки; остальное
    // подтянет клиент, когда оживёт Firebase.
    console.error('[session-user] не удалось прочитать профиль:', error)
    return {
      emailVerified: session.emailVerified,
      user: {
        id: session.uid,
        name: fallbackName,
        email: session.email ?? '',
        phone: '',
        avatar: ''
      }
    }
  }
}
