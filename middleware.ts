import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isAuthenticated = !!req.auth
  const isAuthPage = req.nextUrl.pathname.startsWith('/auth')
  const isPublicApi = req.nextUrl.pathname === '/api/health'
  const isAuthApi = req.nextUrl.pathname.startsWith('/api/auth')
  const isWorkflowApi = req.nextUrl.pathname.match(/^\/api\/jobs\/\d+\/status$/) !== null

  // Detect test mode via header (Edge Runtime can't read process.env.NODE_ENV at runtime)
  const hasTestHeader = req.headers.get('x-test-user-id') !== null
  const isTestMode = hasTestHeader

  // In test mode, bypass auth for ALL routes (API and pages)
  // Page routes use headers() to get x-test-user-id in getCurrentUser()
  // API routes also use headers() for authentication
  if (isTestMode) {
    return NextResponse.next()
  }

  // Allow auth pages, public APIs, and workflow APIs (use Bearer token auth)
  if (isAuthPage || isPublicApi || isAuthApi || isWorkflowApi) {
    return NextResponse.next()
  }

  // Redirect to sign-in if not authenticated
  if (!isAuthenticated) {
    const signInUrl = new URL('/auth/signin', req.url)
    signInUrl.searchParams.set('callbackUrl', req.nextUrl.pathname)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!api/health|api/auth|_next/static|_next/image|favicon.ico).*)',
  ]
}
