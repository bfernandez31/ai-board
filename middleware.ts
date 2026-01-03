import { authEdge } from "@/lib/auth-edge"
import { NextResponse } from "next/server"

export default authEdge((req) => {
  const isAuthenticated = !!req.auth
  const isAuthPage = req.nextUrl.pathname.startsWith('/auth')
  const isPublicApi = req.nextUrl.pathname === '/api/health'
  const isAuthApi = req.nextUrl.pathname.startsWith('/api/auth')
  const isWorkflowApi = req.nextUrl.pathname.match(/^\/api\/jobs\/\d+\/status$/) !== null
  const isTelemetryApi = req.nextUrl.pathname.startsWith('/api/telemetry/')
  const isAIBoardCommentApi = req.nextUrl.pathname.match(/^\/api\/projects\/\d+\/tickets\/[^/]+\/comments\/ai-board$/) !== null
  const isTicketBranchApi = req.nextUrl.pathname.match(/^\/api\/projects\/\d+\/tickets\/[^/]+\/branch$/) !== null
  const isTransitionApi = req.nextUrl.pathname.match(/^\/api\/projects\/\d+\/tickets\/[^/]+\/transition$/) !== null
  const isVerifyTicketsApi = req.nextUrl.pathname.match(/^\/api\/projects\/\d+\/tickets\/verify$/) !== null
  const isPreviewUrlApi = req.nextUrl.pathname.match(/^\/api\/projects\/\d+\/tickets\/[^/]+\/preview-url$/) !== null
  const isTicketSearchApi = req.nextUrl.pathname.match(/^\/api\/projects\/\d+\/tickets\/search$/) !== null
  const isTicketJobsApi = req.nextUrl.pathname.match(/^\/api\/projects\/\d+\/tickets\/\d+\/jobs$/) !== null
  const isLandingPage = req.nextUrl.pathname === '/'

  // Detect test mode via header (Edge Runtime can't read process.env.NODE_ENV at runtime)
  const hasTestHeader = req.headers.get('x-test-user-id') !== null
  const isTestMode = hasTestHeader

  // In test mode, bypass auth for ALL routes (API and pages)
  // Page routes use headers() to get x-test-user-id in getCurrentUser()
  // API routes also use headers() for authentication
  if (isTestMode) {
    return NextResponse.next()
  }

  // Allow public pages, auth pages, public APIs, and workflow APIs
  if (isLandingPage || isAuthPage || isPublicApi || isAuthApi || isWorkflowApi || isTelemetryApi || isAIBoardCommentApi || isTicketBranchApi || isTransitionApi || isVerifyTicketsApi || isPreviewUrlApi || isTicketSearchApi || isTicketJobsApi) {
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
    '/((?!api/health|api/auth|_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.webp).*)',
  ]
}
