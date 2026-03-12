import { auth } from "@/lib/auth"
import {
  getBlockedTestUserOverrideAttempt,
  isExplicitTestOverrideRequest,
  TEST_USER_HEADER,
} from "@/lib/auth/test-user-override"
import { NextRequest, NextResponse } from "next/server"

const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
]

const PUBLIC_PREFIXES = ["/auth", "/api/auth", "/api/push", "/api/telemetry/"]

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

function hasAuthSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((cookieName) => request.cookies.has(cookieName))
}

function isPersonalAccessTokenRequest(request: NextRequest): boolean {
  return request.headers.get("authorization")?.startsWith("Bearer pat_") ?? false
}

function createUnauthorizedApiResponse(): NextResponse {
  return NextResponse.json(
    { error: "Unauthorized", code: "AUTH_REQUIRED" },
    { status: 401 }
  )
}

function createSignInRedirectResponse(request: NextRequest): NextResponse {
  const signInUrl = new URL("/auth/signin", request.url)
  signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname)

  return NextResponse.redirect(signInUrl)
}

function preAuthCheck(request: NextRequest): NextResponse | null {
  if (isPublicRoute(request.nextUrl.pathname)) {
    return null
  }

  if (isPersonalAccessTokenRequest(request)) {
    return NextResponse.next()
  }

  if (request.headers.get(TEST_USER_HEADER) === null) {
    return null
  }

  if (isExplicitTestOverrideRequest(request.headers)) {
    return NextResponse.next()
  }

  if (hasAuthSessionCookie(request)) {
    return null
  }

  const blockedAttempt = getBlockedTestUserOverrideAttempt(
    request.headers,
    request
  )
  if (blockedAttempt) {
    console.warn("[proxy] blocked x-test-user-id override", blockedAttempt)
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return createUnauthorizedApiResponse()
  }

  return createSignInRedirectResponse(request)
}

function isPublicRoute(pathname: string): boolean {
  if (pathname === "/" || pathname === "/api/health") {
    return true
  }

  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true
  }

  return PUBLIC_PATTERNS.some((pattern) => pattern.test(pathname))
}

const authProxy = auth((request) => {
  if (isPublicRoute(request.nextUrl.pathname)) {
    return NextResponse.next()
  }

  if (!request.auth) {
    return createSignInRedirectResponse(request)
  }

  return NextResponse.next()
})

export default async function proxy(
  request: NextRequest,
  ctx: Parameters<typeof authProxy>[1]
) {
  const preAuthResult = preAuthCheck(request)
  if (preAuthResult) {
    return preAuthResult
  }

  return authProxy(request, ctx)
}

export const config = {
  matcher: [
    "/((?!api/health|api/auth|_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.webp).*)",
  ],
}
