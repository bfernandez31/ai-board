import { prisma } from './client';
import type { ApiKeyProvider, ProjectApiKey } from '@prisma/client';

export interface ApiKeyStatus {
  provider: ApiKeyProvider;
  preview: string | null;
  configured: boolean;
  updatedAt: string | null;
}

const ALL_PROVIDERS: ApiKeyProvider[] = ['ANTHROPIC', 'OPENAI'];

/**
 * Get API key status for all providers in a project.
 * Returns both providers with configured boolean — never exposes encrypted keys.
 */
export async function getApiKeysByProject(
  projectId: number
): Promise<ApiKeyStatus[]> {
  const keys = await prisma.projectApiKey.findMany({
    where: { projectId },
    select: {
      provider: true,
      preview: true,
      updatedAt: true,
    },
  });

  const keyMap = new Map(keys.map((k) => [k.provider, k]));

  return ALL_PROVIDERS.map((provider) => {
    const key = keyMap.get(provider);
    return {
      provider,
      preview: key?.preview ?? null,
      configured: !!key,
      updatedAt: key?.updatedAt?.toISOString() ?? null,
    };
  });
}

/**
 * Save or replace an API key for a project+provider.
 * Uses upsert to handle both create and replace.
 */
export async function saveApiKey(
  projectId: number,
  provider: ApiKeyProvider,
  encryptedKey: string,
  preview: string
): Promise<ProjectApiKey> {
  return prisma.projectApiKey.upsert({
    where: {
      projectId_provider: { projectId, provider },
    },
    update: {
      encryptedKey,
      preview,
    },
    create: {
      projectId,
      provider,
      encryptedKey,
      preview,
    },
  });
}

/**
 * Delete an API key for a project+provider.
 * Returns the deleted record, or null if not found.
 */
export async function deleteApiKey(
  projectId: number,
  provider: ApiKeyProvider
): Promise<ProjectApiKey | null> {
  try {
    return await prisma.projectApiKey.delete({
      where: {
        projectId_provider: { projectId, provider },
      },
    });
  } catch {
    return null;
  }
}

/**
 * Get the encrypted key value for a project+provider.
 * Used for decryption at workflow dispatch time.
 */
export async function getEncryptedKey(
  projectId: number,
  provider: ApiKeyProvider
): Promise<string | null> {
  const record = await prisma.projectApiKey.findUnique({
    where: {
      projectId_provider: { projectId, provider },
    },
    select: { encryptedKey: true },
  });

  return record?.encryptedKey ?? null;
}
