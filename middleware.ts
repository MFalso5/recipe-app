import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/api/auth/login', '/login']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Allow static files and Next internals
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next()
  }

  // Check session cookie
  const session = req.cookies.get('rc_session')
  if (session?.value === process.env.SESSION_SECRET) {
    return NextResponse.next()
  }

  // Redirect to login
  const loginUrl = new URL('/login', req.url)
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
