'use server'

import {clearSession} from './session'

// Shared (not route-specific) — logout is triggered from the header on every route.
export async function logoutAction(): Promise<void> {
  await clearSession()
}
