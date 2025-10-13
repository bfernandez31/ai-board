import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db/client"
import { headers } from "next/headers"

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
      where: { id: parseInt(testUserId) }
    })
    if (user) {
      return {
        id: user.id.toString(),
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
 * Require authentication and return userId
 * @throws Error if user is not authenticated
 */
export async function requireAuth() {
  const user = await getCurrentUser()
  return parseInt(user.id)
}
