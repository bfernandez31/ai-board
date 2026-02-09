import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

// Pre-auth checks that must run BEFORE NextAuth middleware
function preAuthCheck(req: NextRequest): NextResponse | null {
  // Check for Bearer token (PAT authentication for MCP server)
  // Must be checked BEFORE auth to avoid NextAuth redirect
  const authHeader = req.headers.get('authorization')
  const hasBearerToken = authHeader?.startsWith('Bearer pat_')
  if (hasBearerToken) {
    return NextResponse.next()
  }

  // Detect test mode via header (Edge Runtime can't read process.env.NODE_ENV at runtime)
  const hasTestHeader = req.headers.get('x-test-user-id') !== null
  if (hasTestHeader) {
    return NextResponse.next()
  }

  return null // Continue to auth
}

// Main auth handler wrapped with NextAuth
const authProxy = auth((req) => {
  const isAuthenticated = !!req.auth
  const isAuthPage = req.nextUrl.pathname.startsWith('/auth')
  const isPublicApi = req.nextUrl.pathname === '/api/health'
  const isAuthApi = req.nextUrl.pathname.startsWith('/api/auth')
  const isPushApi = req.nextUrl.pathname.startsWith('/api/push')
  const isWorkflowApi = req.nextUrl.pathname.match(/^\/api\/jobs\/\d+\/status$/) !== null
  const isProjectJobsApi = req.nextUrl.pathname.match(/^\/api\/projects\/\d+\/jobs$/) !== null
  const isTelemetryApi = req.nextUrl.pathname.startsWith('/api/telemetry/')
  const isAIBoardCommentApi = req.nextUrl.pathname.match(/^\/api\/projects\/\d+\/tickets\/[^/]+\/comments\/ai-board$/) !== null
  const isTicketBranchApi = req.nextUrl.pathname.match(/^\/api\/projects\/\d+\/tickets\/[^/]+\/branch$/) !== null
  const isTransitionApi = req.nextUrl.pathname.match(/^\/api\/projects\/\d+\/tickets\/[^/]+\/transition$/) !== null
  const isVerifyTicketsApi = req.nextUrl.pathname.match(/^\/api\/projects\/\d+\/tickets\/verify$/) !== null
  const isPreviewUrlApi = req.nextUrl.pathname.match(/^\/api\/projects\/\d+\/tickets\/[^/]+\/preview-url$/) !== null
  const isTicketSearchApi = req.nextUrl.pathname.match(/^\/api\/projects\/\d+\/tickets\/search$/) !== null
  const isTicketJobsApi = req.nextUrl.pathname.match(/^\/api\/projects\/\d+\/tickets\/\d+\/jobs$/) !== null
  const isLandingPage = req.nextUrl.pathname === '/'

  // Allow public pages, auth pages, public APIs, and workflow APIs
  // Note: isPushApi routes have their own requireAuth() check, so we let them through
  // to avoid redirect loops and let them return proper 401 responses
  if (isLandingPage || isAuthPage || isPublicApi || isAuthApi || isPushApi || isWorkflowApi || isProjectJobsApi || isTelemetryApi || isAIBoardCommentApi || isTicketBranchApi || isTransitionApi || isVerifyTicketsApi || isPreviewUrlApi || isTicketSearchApi || isTicketJobsApi) {
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

// Export proxy that runs pre-auth checks first
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
