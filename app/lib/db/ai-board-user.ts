import { prisma } from '@/lib/db/client';

/**
 * AI-BOARD system user ID cache (in-memory)
 * Initialized on first call to getAIBoardUserId()
 */
let cachedAIBoardUserId: string | null = null;

/**
 * Get AI-BOARD system user ID with in-memory caching
 *
 * @returns AI-BOARD user ID
 * @throws Error if AI-BOARD user not found (requires seed script execution)
 *
 * @example
 * const aiBoardId = await getAIBoardUserId();
 * // Returns: 'ai-board-system-user'
 */
export async function getAIBoardUserId(): Promise<string> {
  // Return cached value if available
  if (cachedAIBoardUserId) {
    return cachedAIBoardUserId;
  }

  // Query database for AI-BOARD user
  const user = await prisma.user.findUnique({
    where: { email: 'ai-board@system.local' },
    select: { id: true },
  });

  if (!user) {
    throw new Error(
      'AI-BOARD user not found - run seed script: npm run db:seed'
    );
  }

  // Cache user ID for subsequent calls
  cachedAIBoardUserId = user.id;
  return user.id;
}

/**
 * Reset AI-BOARD user ID cache (for testing purposes)
 * @internal
 */
export function resetAIBoardUserCache(): void {
  cachedAIBoardUserId = null;
}
