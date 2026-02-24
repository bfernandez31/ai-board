import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

function preAuthCheck(req: NextRequest): NextResponse | null {
  // PAT auth must be checked before NextAuth to avoid redirect
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer pat_')) {
    return NextResponse.next()
  }
  // process.env.NODE_ENV is inlined at build time by Next.js, safe in Edge Runtime
  if (process.env.NODE_ENV === 'test' && req.headers.has('x-test-user-id')) {
    return NextResponse.next()
  }
  return null
}

// Push API routes have their own requireAuth() - let through to avoid redirect loops
const PUBLIC_PREFIXES = ['/auth', '/api/auth', '/api/push', '/api/telemetry/']

const PUBLIC_PATTERNS = [
  /^\/api\/jobs\/\d+\/status$/,
  /^\/api\/projects\/\d+\/jobs$/,
  /^\/api\/projects\/\d+\/tickets\/[^/]+\/comments\/ai-board$/,
  /^\/api\/projects\/\d+\/tickets\/[^/]+\/branch$/,
  /^\/api\/projects\/\d+\/tickets\/[^/]+\/transition$/,
  /^\/api\/projects\/\d+\/tickets\/verify$/,
  /^\/api\/projects\/\d+\/tickets\/[^/]+\/preview-url$/,
  /^\/api\/projects\/\d+\/tickets\/search$/,
  /^\/api\/projects\/\d+\/tickets\/\d+\/jobs$/,
]

function isPublicRoute(pathname: string): boolean {
  if (pathname === '/' || pathname === '/api/health') return true
  if (PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))) return true
  return PUBLIC_PATTERNS.some(pattern => pattern.test(pathname))
}

const authProxy = auth((req) => {
  if (isPublicRoute(req.nextUrl.pathname)) {
    return NextResponse.next()
  }

  if (!req.auth) {
    const signInUrl = new URL('/auth/signin', req.url)
    signInUrl.searchParams.set('callbackUrl', req.nextUrl.pathname)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
})

export default async function proxy(
  req: NextRequest,
  ctx: Parameters<typeof authProxy>[1]
) {
  const preAuthResult = preAuthCheck(req)
  if (preAuthResult) {
    return preAuthResult
  }
  return authProxy(req, ctx)
}

export const config = {
  matcher: [
    '/((?!api/health|api/auth|_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.webp).*)',
  ]
}
