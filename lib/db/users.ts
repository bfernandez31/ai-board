import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db/client"
import { headers } from "next/headers"
import { extractBearerToken, validateToken } from "@/lib/tokens/validate"
import type { NextRequest } from "next/server"
import { stripe } from "@/lib/billing/stripe"

/**
 * Get the current authenticated user
 * @throws Error if user is not authenticated
 */
export async function getCurrentUser() {
  // Check for test user header (bypasses NextAuth in test mode)
  const headersList = await headers()
  const testUserId = headersList.get('x-test-user-id')

  if (testUserId) {
    const user = await prisma.user.findUnique({
      where: { id: testUserId }
    })
    if (user) {
      return {
        id: user.id,
        email: user.email,
        name: user.name
      }
    }
  }

  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return session.user
}

/**
 * Get the current authenticated user without throwing
 * @returns User object if authenticated, null otherwise
 */
export async function getCurrentUserOrNull() {
  try {
    return await getCurrentUser()
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
) {
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
      // Fetch user details
      const user = await prisma.user.findUnique({
        where: { id: result.userId },
        select: { id: true, email: true, name: true }
      })

      if (user && user.email) {
        return {
          id: user.id,
          email: user.email,
          name: user.name
        }
      }
    }

    // Token provided but invalid - throw immediately
    throw new Error(result.error || "Unauthorized")
  }

  // Fall back to session auth
  return getCurrentUser()
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
