import { prisma } from "@/lib/db/client";

/**
 * Token list item returned from database (excludes sensitive data)
 */
export interface TokenListItem {
  id: number;
  name: string;
  preview: string;
  lastUsedAt: Date | null;
  createdAt: Date;
}

/**
 * Create a new personal access token in the database.
 * @param userId - The ID of the user creating the token
 * @param name - User-provided name for the token
 * @param hash - SHA-256 hash of salt+token
 * @param salt - Random salt used for hashing
 * @param preview - Last 4 characters of token for display
 */
export async function createToken(
  userId: string,
  name: string,
  hash: string,
  salt: string,
  preview: string
): Promise<TokenListItem> {
  const token = await prisma.personalAccessToken.create({
    data: {
      userId,
      name,
      hash,
      salt,
      preview,
    },
    select: {
      id: true,
      name: true,
      preview: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });
  return token;
}

/**
 * List all tokens for a user.
 * @param userId - The ID of the user
 * @returns Array of token metadata (no sensitive data)
 */
export async function listTokens(userId: string): Promise<TokenListItem[]> {
  return prisma.personalAccessToken.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      preview: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Delete a token by ID, ensuring it belongs to the user.
 * @param id - Token ID
 * @param userId - Owner's user ID (for authorization)
 * @returns true if deleted, false if not found or not owned
 */
export async function deleteToken(id: number, userId: string): Promise<boolean> {
  const result = await prisma.personalAccessToken.deleteMany({
    where: {
      id,
      userId,
    },
  });
  return result.count > 0;
}

/**
 * Find token candidates by preview for validation lookup.
 * @param preview - Last 4 characters of the token
 * @returns Array of token records with hash/salt for verification
 */
export async function findTokensByPreview(preview: string): Promise<
  Array<{
    id: number;
    userId: string;
    hash: string;
    salt: string;
  }>
> {
  return prisma.personalAccessToken.findMany({
    where: { preview },
    select: {
      id: true,
      userId: true,
      hash: true,
      salt: true,
    },
  });
}

/**
 * Update the lastUsedAt timestamp for a token.
 * Fire-and-forget - failures are logged but don't affect request.
 * @param id - Token ID
 */
export async function updateLastUsed(id: number): Promise<void> {
  try {
    await prisma.personalAccessToken.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  } catch (error) {
    // Log but don't throw - this is non-critical
    console.error("Failed to update token lastUsedAt:", error);
  }
}
