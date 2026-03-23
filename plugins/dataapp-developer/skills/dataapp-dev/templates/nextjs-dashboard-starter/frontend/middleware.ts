import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Local dev only: simulate Keboola OIDC header injection (mirrors what Nginx does in production).
// Set LOCAL_OIDC_EMAIL in frontend/.env.local to impersonate a user via the real header path.
const LOCAL_OIDC_EMAIL = process.env.LOCAL_OIDC_EMAIL

export function middleware(request: NextRequest) {
  if (!LOCAL_OIDC_EMAIL) return NextResponse.next()

  const headers = new Headers(request.headers)
  headers.set('X-Kbc-User-Email', LOCAL_OIDC_EMAIL)

  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: '/api/:path*',
}
