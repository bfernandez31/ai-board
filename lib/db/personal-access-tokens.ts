import { prisma } from './client';
import { createHash, randomBytes } from 'crypto';

const TOKEN_PREFIX = 'pat_';
const TOKEN_BYTES = 32; // 32 bytes = 64 hex chars

/**
 * Generate a new personal access token
 * Returns the plain token (to show user once) and hashed version (to store)
 */
export function generateToken(): { plainToken: string; tokenHash: string; tokenPreview: string } {
  const randomPart = randomBytes(TOKEN_BYTES).toString('hex');
  const plainToken = `${TOKEN_PREFIX}${randomPart}`;
  const tokenHash = hashToken(plainToken);
  const tokenPreview = `...${randomPart.slice(-4)}`;

  return { plainToken, tokenHash, tokenPreview };
}

/**
 * Hash a token using SHA-256
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Create a new personal access token for a user
 * Returns the plain token (shown once) and the token record
 */
export async function createPersonalAccessToken(
  userId: string,
  name: string
): Promise<{ plainToken: string; token: { id: number; name: string; tokenPreview: string; createdAt: Date } }> {
  const { plainToken, tokenHash, tokenPreview } = generateToken();

  const token = await prisma.personalAccessToken.create({
    data: {
      userId,
      name,
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

  return { plainToken, token };
}

/**
 * Get all personal access tokens for a user
 */
export async function getUserPersonalAccessTokens(userId: string) {
  return prisma.personalAccessToken.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      tokenPreview: true,
      createdAt: true,
      lastUsedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Delete a personal access token
 * Returns true if deleted, false if not found or not owned by user
 */
export async function deletePersonalAccessToken(userId: string, tokenId: number): Promise<boolean> {
  const result = await prisma.personalAccessToken.deleteMany({
    where: { id: tokenId, userId },
  });
  return result.count > 0;
}

/**
 * Validate a token and return the user if valid
 * Updates lastUsedAt on successful validation
 */
export async function validatePersonalAccessToken(token: string): Promise<{ userId: string; email: string; name: string | null } | null> {
  if (!token.startsWith(TOKEN_PREFIX)) {
    return null;
  }

  const tokenHash = hashToken(token);

  const pat = await prisma.personalAccessToken.findFirst({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (!pat) {
    return null;
  }

  // Update lastUsedAt asynchronously (don't block the response)
  prisma.personalAccessToken.update({
    where: { id: pat.id },
    data: { lastUsedAt: new Date() },
  }).catch((error) => {
    console.error('Failed to update lastUsedAt for PAT:', error);
  });

  return {
    userId: pat.user.id,
    email: pat.user.email,
    name: pat.user.name,
  };
}
