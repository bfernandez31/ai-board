import { prisma } from '@/lib/db/client';
import { decryptCredential } from './crypto';
import { PROVIDER_ENV_VAR_MAP } from './types';
import type { WorkflowResolvedCredential } from './types';
import type { CredentialProvider, UserCredential } from '@prisma/client';

export const MISSING_CREDENTIAL_ERROR =
  'No AI credential configured. Please add your API key in Settings → AI Credentials.';

export async function getOwnerCredential(
  projectId: number,
  provider: CredentialProvider = 'ANTHROPIC'
): Promise<UserCredential | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });

  if (!project) return null;

  return prisma.userCredential.findFirst({
    where: {
      userId: project.userId,
      provider,
    },
  });
}

export function buildWorkflowPayload(
  credential: UserCredential
): WorkflowResolvedCredential {
  const secret = decryptCredential(
    credential.encryptedValue,
    credential.iv,
    credential.authTag
  );

  const providerMap = PROVIDER_ENV_VAR_MAP[credential.provider];
  const envVar = providerMap[credential.credentialType] ?? providerMap['API_KEY'] ?? `${credential.provider}_API_KEY`;

  return {
    provider: credential.provider,
    credentialType: credential.credentialType as 'API_KEY' | 'OAUTH_TOKEN',
    envVar,
    secret,
    ownerUserId: credential.userId,
  };
}
