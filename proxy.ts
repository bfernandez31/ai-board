import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import {
  getBlockedTestUserOverrideAttempt,
  isExplicitTestOverrideRequest,
  TEST_USER_HEADER,
} from "@/lib/auth/test-user-override"

const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
]

function hasAuthSessionCookie(req: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((cookieName) => req.cookies.has(cookieName))
}

function preAuthCheck(req: NextRequest): NextResponse | null {
  if (isPublicRoute(req.nextUrl.pathname)) {
    return null
  }

  // PAT auth must be checked before NextAuth to avoid redirect
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer pat_')) {
    return NextResponse.next()
  }

  if (req.headers.get(TEST_USER_HEADER) === null) {
    return null
  }

  if (isExplicitTestOverrideRequest(req.headers)) {
    return NextResponse.next()
  }

  if (hasAuthSessionCookie(req)) {
    return null
  }

  const blockedAttempt = getBlockedTestUserOverrideAttempt(req.headers, req)
  if (blockedAttempt) {
    console.warn("[proxy] blocked x-test-user-id override", blockedAttempt)
  }

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Unauthorized", code: "AUTH_REQUIRED" },
      { status: 401 }
    )
  }

  const signInUrl = new URL('/auth/signin', req.url)
  signInUrl.searchParams.set('callbackUrl', req.nextUrl.pathname)
  return NextResponse.redirect(signInUrl)
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
