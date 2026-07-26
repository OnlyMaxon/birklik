import {NextResponse} from 'next/server'
import type {NextRequest} from 'next/server'
import {SESSION_COOKIE_NAME} from '@/lib/auth/session-cookie'

// Fast, edge-safe redirect for fully logged-out visitors. This only checks that a
// session cookie is present — it does not verify it (that needs the Admin SDK, done
// server-side in the dashboard layout). Signed-out and expired/tampered cookies are
// still caught there; this is just a cheap first line of defense against the
// flash-of-redirect the client-side ProtectedRoute currently shows.
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME)
  if (!hasSession) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*']
}
