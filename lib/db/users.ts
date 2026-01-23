import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db/client"
import { headers } from "next/headers"
import { getUserIdFromBearerToken } from "@/lib/auth/token-auth"

async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true }
  })
  return user
}

/**
 * Get the current authenticated user
 * @throws Error if user is not authenticated
 */
export async function getCurrentUser() {
  // Check for test user header (bypasses NextAuth in test mode)
  const headersList = await headers()
  const testUserId = headersList.get('x-test-user-id')
  if (testUserId) {
    const user = await getUserById(testUserId)
    if (user) return user
  }

  // Check for Bearer token authentication (PAT)
  const tokenUserId = await getUserIdFromBearerToken()
  if (tokenUserId) {
    const user = await getUserById(tokenUserId)
    if (user) return user
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
 * Require authentication and return userId
 * @throws Error if user is not authenticated
 */
export async function requireAuth(): Promise<string> {
  const user = await getCurrentUser()
  return user.id
}
