import { prisma } from './client';
import { encryptApiKey, decryptApiKey } from '@/lib/encryption/api-keys';
import type { APIProvider } from '@prisma/client';
import type { APIKeyStatus } from '@/lib/types/api-keys';

/**
 * Save or replace an API key for a project+provider.
 * Encrypts the key before storage and stores last 4 chars as preview.
 */
export async function saveApiKey(
  projectId: number,
  provider: APIProvider,
  plainKey: string
): Promise<{ preview: string }> {
  const trimmed = plainKey.trim();
  const encryptedKey = encryptApiKey(trimmed);
  const preview = trimmed.slice(-4);

  await prisma.projectAPIKey.upsert({
    where: {
      projectId_provider: { projectId, provider },
    },
    create: {
      projectId,
      provider,
      encryptedKey,
      preview,
    },
    update: {
      encryptedKey,
      preview,
    },
  });

  return { preview };
}

/**
 * List API key statuses for a project.
 * Always returns both providers. Owner gets preview + updatedAt; member gets only configured status.
 */
export async function listApiKeys(
  projectId: number,
  isOwner: boolean
): Promise<APIKeyStatus[]> {
  const keys = await prisma.projectAPIKey.findMany({
    where: { projectId },
    select: {
      provider: true,
      preview: true,
      updatedAt: true,
    },
  });

  const keyMap = new Map(keys.map((k) => [k.provider, k]));
  const providers: APIProvider[] = ['ANTHROPIC', 'OPENAI'];

  return providers.map((provider) => {
    const key = keyMap.get(provider);
    return {
      provider,
      configured: !!key,
      preview: isOwner && key ? key.preview : null,
      updatedAt: isOwner && key ? key.updatedAt.toISOString() : null,
    };
  });
}

/**
 * Delete an API key for a project+provider.
 * Returns true if deleted, false if not found.
 */
export async function deleteApiKey(
  projectId: number,
  provider: APIProvider
): Promise<boolean> {
  try {
    await prisma.projectAPIKey.delete({
      where: {
        projectId_provider: { projectId, provider },
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the decrypted API key for workflow dispatch.
 * Returns null if no key is configured for this provider.
 */
export async function getDecryptedKey(
  projectId: number,
  provider: APIProvider
): Promise<string | null> {
  const record = await prisma.projectAPIKey.findUnique({
    where: {
      projectId_provider: { projectId, provider },
    },
    select: { encryptedKey: true },
  });

  if (!record) return null;

  return decryptApiKey(record.encryptedKey);
}
