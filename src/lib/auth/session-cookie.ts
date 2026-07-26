// No server-only/admin-SDK imports here on purpose — this constant is shared
// with proxy.ts, which only needs the cookie name, not the ability to verify it.
export const SESSION_COOKIE_NAME = 'session'
