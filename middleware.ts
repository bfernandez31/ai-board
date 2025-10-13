import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isAuthenticated = !!req.auth
  const isAuthPage = req.nextUrl.pathname.startsWith('/auth')
  const isPublicApi = req.nextUrl.pathname === '/api/health'
  const isAuthApi = req.nextUrl.pathname.startsWith('/api/auth')
  const isTestMode = process.env.NODE_ENV === 'test'
  const isApiRoute = req.nextUrl.pathname.startsWith('/api/')

  // In test mode, bypass auth for API routes (handled by route handlers)
  if (isTestMode && isApiRoute) {
    return NextResponse.next()
  }

  // Allow auth pages and public APIs
  if (isAuthPage || isPublicApi || isAuthApi) {
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
