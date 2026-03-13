import { prisma } from "./client";
import { ApiKeyProvider } from "@prisma/client";
import { decryptApiKey } from "@/lib/crypto/encrypt";

/**
 * Get the decrypted API key for a project and provider.
 * Used by workflow dispatch to pass keys to CI jobs.
 * @returns The plaintext API key, or null if not configured.
 */
export async function getProjectApiKey(
  projectId: number,
  provider: ApiKeyProvider
): Promise<string | null> {
  const record = await prisma.projectApiKey.findUnique({
    where: {
      projectId_provider: { projectId, provider },
    },
  });

  if (!record) {
    return null;
  }

  return decryptApiKey({
    encryptedKey: record.encryptedKey,
    iv: record.iv,
    authTag: record.authTag,
  });
}

/**
 * Check which API key providers are configured for a project.
 * @returns Map of provider to boolean (configured or not)
 */
export async function getProjectApiKeyStatus(
  projectId: number
): Promise<Record<ApiKeyProvider, boolean>> {
  const keys = await prisma.projectApiKey.findMany({
    where: { projectId },
    select: { provider: true },
  });

  const configuredProviders = new Set(keys.map((k) => k.provider));

  return {
    [ApiKeyProvider.ANTHROPIC]: configuredProviders.has(ApiKeyProvider.ANTHROPIC),
    [ApiKeyProvider.OPENAI]: configuredProviders.has(ApiKeyProvider.OPENAI),
  };
}
