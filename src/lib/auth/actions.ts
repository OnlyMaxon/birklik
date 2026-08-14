'use server'

import {createSession, clearSession} from './session'

/**
 * Меняет idToken, полученный браузером, на сессионную куку.
 *
 * Вход и регистрация обязаны выполняться клиентским SDK: на проекте включён
 * App Check, а он аттестует именно браузер — у сервера токена быть не может.
 * Сюда приходит уже добытый idToken, и createSession обменивает его на куку
 * под сервис-аккаунтом, к которому App Check не применяется.
 */
export async function createSessionAction(idToken: string): Promise<{success: boolean}> {
  try {
    await createSession(idToken)
    return {success: true}
  } catch {
    // Токен просрочен, подделан или выдан другим проектом — во всех случаях
    // куку не выписываем, клиент останется гостем.
    return {success: false}
  }
}

// Shared (not route-specific) — logout is triggered from the header on every route.
export async function logoutAction(): Promise<void> {
  await clearSession()
}
