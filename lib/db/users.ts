import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db/client"
import { headers } from "next/headers"
import { extractBearerToken, validateToken } from "@/lib/tokens/validate"
import type { NextRequest } from "next/server"
import { stripe } from "@/lib/billing/stripe"
import {
  getBlockedTestUserOverrideAttempt,
  getRequestPath,
  isExplicitTestOverrideRequest,
  TEST_USER_HEADER,
  type TestUserOverrideAttempt,
  type TestUserOverrideRejectionReason,
} from "@/lib/auth/test-user-override"

export interface AuthenticatedUser {
  id: string
  email: string
  name?: string | null | undefined
  source: "session" | "pat" | "test-override"
}

export interface TestUserOverrideResolution {
  requestedUserId: string | null
  allowed: boolean
  rejectionReason: TestUserOverrideRejectionReason | null
}

type AuthRequest = Pick<NextRequest, "headers" | "nextUrl" | "url">

function isSeededTestUser(user: { id: string; email: string }): boolean {
  return (
    user.id === "test-user-id" ||
    user.email.endsWith("@e2e.local") ||
    user.email.endsWith(".e2e.test")
  )
}

function toAuthenticatedUser(
  user: {
    id: string
    email?: string | null | undefined
    name?: string | null | undefined
  },
  source: AuthenticatedUser["source"]
): AuthenticatedUser {
  if (!user.email) {
    throw new Error("Unauthorized")
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    source,
  }
}

export function logBlockedTestUserOverrideAttempt(
  attempt: TestUserOverrideAttempt
): void {
  console.warn("[auth] blocked x-test-user-id override", {
    route: attempt.route,
    reason: attempt.reason,
    requestedUserId: attempt.requestedUserId,
  })
}

async function getRequestHeaders(request?: AuthRequest): Promise<Headers> {
  if (request) {
    return request.headers
  }

  return await headers()
}

export async function getTestUserOverrideResolution(
  request?: AuthRequest
): Promise<TestUserOverrideResolution> {
  const requestHeaders = await getRequestHeaders(request)
  const requestedUserId = requestHeaders.get(TEST_USER_HEADER)

  if (!requestedUserId) {
    return {
      requestedUserId: null,
      allowed: false,
      rejectionReason: null,
    }
  }

  const blockedAttempt = getBlockedTestUserOverrideAttempt(requestHeaders, request)
  if (blockedAttempt) {
    logBlockedTestUserOverrideAttempt(blockedAttempt)
    return {
      requestedUserId,
      allowed: false,
      rejectionReason: blockedAttempt.reason,
    }
  }

  return {
    requestedUserId,
    allowed: isExplicitTestOverrideRequest(requestHeaders),
    rejectionReason: null,
  }
}

async function resolveSessionUser(): Promise<AuthenticatedUser | null> {
  const session = await auth()
  if (!session?.user?.id) {
    return null
  }

  return toAuthenticatedUser(
    {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    },
    "session"
  )
}

async function resolveTestOverrideUser(
  request?: AuthRequest
): Promise<AuthenticatedUser | null> {
  const resolution = await getTestUserOverrideResolution(request)
  if (!resolution.requestedUserId) {
    return null
  }

  if (!resolution.allowed) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: resolution.requestedUserId },
    select: { id: true, email: true, name: true },
  })

  if (!user?.email || !isSeededTestUser({ id: user.id, email: user.email })) {
    logBlockedTestUserOverrideAttempt({
      requestedUserId: resolution.requestedUserId,
      route: getRequestPath(request),
      reason: "user-not-found",
    })
    throw new Error("Unauthorized")
  }

  return toAuthenticatedUser(user, "test-override")
}

/**
 * Get the current authenticated user
 * @throws Error if user is not authenticated
 */
export async function getCurrentUser(
  request?: AuthRequest
): Promise<AuthenticatedUser> {
  const sessionUser = await resolveSessionUser()
  if (sessionUser) {
    await getTestUserOverrideResolution(request)
    return sessionUser
  }

  const overrideUser = await resolveTestOverrideUser(request)
  if (overrideUser) {
    return overrideUser
  }

  throw new Error("Unauthorized")
}

/**
 * Get the current authenticated user without throwing
 * @returns User object if authenticated, null otherwise
 */
export async function getCurrentUserOrNull(
  request?: AuthRequest
): Promise<AuthenticatedUser | null> {
  try {
    return await getCurrentUser(request)
  } catch {
    return null
  }
}

/**
 * Require authentication and return userId.
 * Supports both session auth and Bearer token (PAT) authentication.
 * @param request - Optional NextRequest for Bearer token extraction
 * @throws Error if user is not authenticated
 */
export async function requireAuth(request?: NextRequest): Promise<string> {
  if (request) {
    // Use dual auth (Bearer token OR session) when request is provided
    const user = await getCurrentUserOrToken(request)
    return user.id
  }
  // Fall back to session-only auth
  const user = await getCurrentUser()
  return user.id
}

/**
 * Get the current authenticated user from either Bearer token or session.
 * Checks for PAT (Personal Access Token) first, falls back to session auth.
 * @param request - NextRequest with Authorization header
 * @throws Error if neither token nor session is valid
 */
export async function getCurrentUserOrToken(
  request: NextRequest
): Promise<AuthenticatedUser> {
  // Check for Bearer token
  const authHeader = request.headers.get("authorization")
  const token = extractBearerToken(authHeader)

  if (token) {
    // Get client IP for rate limiting
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
               request.headers.get("x-real-ip") ||
               "unknown"

    const result = await validateToken(token, ip)

    if (result.valid && result.userId) {
      const blockedAttempt = getBlockedTestUserOverrideAttempt(
        request.headers,
        request
      )
      if (blockedAttempt) {
        logBlockedTestUserOverrideAttempt(blockedAttempt)
      }

      // Fetch user details
      const user = await prisma.user.findUnique({
        where: { id: result.userId },
        select: { id: true, email: true, name: true }
      })

      if (user) {
        return toAuthenticatedUser(user, "pat")
      }
    }

    // Token provided but invalid - throw immediately
    throw new Error(result.error || "Unauthorized")
  }

  // Fall back to session auth
  return getCurrentUser(request)
}

/**
 * Delete a user account, canceling any active Stripe subscription first.
 * @param userId - The user ID to delete
 * @throws Error if Stripe cancellation fails (blocks account deletion)
 */
export async function deleteUserAccount(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true, subscription: true },
  })

  if (!user) {
    throw new Error('User not found')
  }

  // Cancel Stripe subscription before deleting account
  if (user.subscription?.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(user.subscription.stripeSubscriptionId)
    } catch (error) {
      console.error('Failed to cancel Stripe subscription:', error)
      throw new Error('Failed to cancel subscription. Account deletion blocked.')
    }
  }

  // Prisma cascade will handle Subscription record deletion
  await prisma.user.delete({ where: { id: userId } })
}
