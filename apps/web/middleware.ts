// apps/web/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Indica quali rotte devono passare dal middleware
export const config = {
  matcher: [
    '/',                 // root
    '/dashboard',        // dashboard player
    '/gm/:path*',        // tutte le pagine GM
    '/tools/:path*',     // tool player
    '/player/:path*',    // future pagine player
    // NB: lasciamo fuori /auth/* per non bloccare login/registrazione
  ],
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone()
  const hasSession = !!req.cookies.get('archei_session')?.value

  const isAuthRoute =
    url.pathname.startsWith('/auth') ||
    url.pathname === '/api/auth/login' ||
    url.pathname === '/api/auth/register' ||
    url.pathname === '/api/auth/logout'

  // 1) Se NON autenticato e NON sta già andando su /auth/* -> manda al login
  if (!hasSession && !isAuthRoute) {
    url.pathname = '/auth/login'
    // Mantieni redirect “soft” (no infinite loop)
    return NextResponse.redirect(url)
  }

  // 2) Se autenticato e tenta di andare su root o /auth/* -> porta alla dashboard
  if (hasSession && (url.pathname === '/' || url.pathname === '/auth' || url.pathname.startsWith('/auth'))) {
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // 3) Altrimenti prosegui normalmente
  return NextResponse.next()
}
