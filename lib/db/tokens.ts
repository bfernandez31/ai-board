import { prisma } from '@/lib/db/client';
import { requireAuth } from '@/lib/db/users';
import {
  generateToken,
  getTokenLookup,
  getTokenPreview,
  hashToken,
  verifyToken,
} from '@/lib/auth/token-utils';

const MAX_TOKENS_PER_USER = 10;

/**
 * List all tokens for the current user
 */
export async function listTokens() {
  const userId = await requireAuth();
  return prisma.personalAccessToken.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      tokenPreview: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });
}

/**
 * Create a new token for the current user
 * @param name User-provided name for the token
 * @returns Created token with plain token value (shown once)
 */
export async function createToken(name: string) {
  const userId = await requireAuth();

  // Check token limit
  const count = await prisma.personalAccessToken.count({ where: { userId } });
  if (count >= MAX_TOKENS_PER_USER) {
    throw new Error('TOKEN_LIMIT_EXCEEDED');
  }

  const plainToken = generateToken();
  const tokenLookup = getTokenLookup(plainToken);
  const tokenHash = await hashToken(plainToken);
  const tokenPreview = getTokenPreview(plainToken);

  const created = await prisma.personalAccessToken.create({
    data: {
      userId,
      name,
      tokenLookup,
      tokenHash,
      tokenPreview,
    },
    select: {
      id: true,
      name: true,
      tokenPreview: true,
      createdAt: true,
    },
  });

  // Return plain token ONCE - never stored
  return {
    ...created,
    token: plainToken,
  };
}

/**
 * Revoke (delete) a token
 * @param tokenId Token ID to revoke
 */
export async function revokeToken(tokenId: number) {
  const userId = await requireAuth();

  const deleted = await prisma.personalAccessToken.deleteMany({
    where: { id: tokenId, userId },
  });

  if (deleted.count === 0) {
    throw new Error('Token not found');
  }
}

/**
 * Validate a plain token and return the user ID if valid
 * @param plainToken The plain token to validate
 * @returns User ID if valid, null if invalid
 */
export async function validateToken(plainToken: string): Promise<string | null> {
  const tokenLookup = getTokenLookup(plainToken);

  const token = await prisma.personalAccessToken.findUnique({
    where: { tokenLookup },
    select: { id: true, userId: true, tokenHash: true },
  });

  if (!token) return null;

  const isValid = await verifyToken(plainToken, token.tokenHash);
  if (!isValid) return null;

  // Update lastUsedAt asynchronously (don't block the request)
  prisma.personalAccessToken
    .update({
      where: { id: token.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(console.error);

  return token.userId;
}
