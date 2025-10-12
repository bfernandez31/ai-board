import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db/client"

/**
 * Get the current authenticated user
 * @throws Error if user is not authenticated
 */
export async function getCurrentUser() {
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
