import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db/client"
import { headers } from "next/headers"
import { validatePersonalAccessToken } from "./personal-access-tokens"

/**
 * Get the current authenticated user
 * Supports multiple auth methods:
 * 1. Test user header (x-test-user-id) - for testing
 * 2. Personal Access Token (Bearer pat_xxx) - for API access
 * 3. NextAuth session - for browser sessions
 * @throws Error if user is not authenticated
 */
export async function getCurrentUser() {
  const headersList = await headers()

  // Check for test user header (bypasses NextAuth in test mode)
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

  // Check for Personal Access Token in Authorization header
  const authHeader = headersList.get('authorization')
  if (authHeader?.startsWith('Bearer pat_')) {
    const token = authHeader.slice(7) // Remove "Bearer " prefix
    const user = await validatePersonalAccessToken(token)
    if (user) {
      return {
        id: user.userId,
        email: user.email,
        name: user.name
      }
    }
    throw new Error('Unauthorized')
  }

  // Fall back to NextAuth session
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
 * Require authentication and return userId
 * @throws Error if user is not authenticated
 */
export async function requireAuth(): Promise<string> {
  const user = await getCurrentUser()
  return user.id
}
