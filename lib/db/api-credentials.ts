import { prisma } from './client';
import { AiProvider, CredentialType } from '@prisma/client';
import { encrypt, decrypt } from '@/lib/crypto/encrypt';

/**
 * Upsert an API credential for a user+provider (one credential per provider per user).
 * The key is encrypted at rest using AES-256-GCM.
 */
export async function upsertApiCredential(
  userId: string,
  provider: AiProvider,
  credentialType: CredentialType,
  label: string,
  apiKey: string
) {
  const { encryptedKey, iv, authTag } = encrypt(apiKey);
  const preview = apiKey.slice(-4);

  return prisma.apiCredential.upsert({
    where: { userId_provider: { userId, provider } },
    create: {
      userId,
      provider,
      credentialType,
      label,
      encryptedKey,
      iv,
      authTag,
      preview,
    },
    update: {
      credentialType,
      label,
      encryptedKey,
      iv,
      authTag,
      preview,
    },
    select: {
      id: true,
      provider: true,
      credentialType: true,
      label: true,
      preview: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Get API credential metadata (no decrypted key) for the current user.
 */
export async function getApiCredential(userId: string, provider: AiProvider) {
  return prisma.apiCredential.findUnique({
    where: { userId_provider: { userId, provider } },
    select: {
      id: true,
      provider: true,
      credentialType: true,
      label: true,
      preview: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * List all API credentials (metadata only) for a user.
 */
export async function listApiCredentials(userId: string) {
  return prisma.apiCredential.findMany({
    where: { userId },
    select: {
      id: true,
      provider: true,
      credentialType: true,
      label: true,
      preview: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Delete an API credential.
 * Returns true if deleted, false if not found.
 */
export async function deleteApiCredential(id: number, userId: string): Promise<boolean> {
  const result = await prisma.apiCredential.deleteMany({
    where: { id, userId },
  });
  return result.count > 0;
}

/**
 * Decrypt and return the API key for a user+provider.
 * Used by workflow fetch endpoint — NEVER expose to client.
 */
export async function decryptApiKey(
  userId: string,
  provider: AiProvider
): Promise<{ key: string; credentialType: CredentialType } | null> {
  const credential = await prisma.apiCredential.findUnique({
    where: { userId_provider: { userId, provider } },
    select: {
      encryptedKey: true,
      iv: true,
      authTag: true,
      credentialType: true,
    },
  });

  if (!credential) return null;

  const key = decrypt({
    encryptedKey: credential.encryptedKey,
    iv: credential.iv,
    authTag: credential.authTag,
  });

  return { key, credentialType: credential.credentialType };
}
