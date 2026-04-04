import { prisma } from '@/lib/db/client';
import { decryptCredential } from './crypto';
import { getEnvVar } from './types';
import type { WorkflowResolvedCredential } from './types';
import type { CredentialProvider, UserCredential } from '@prisma/client';

export function getMissingCredentialError(provider: CredentialProvider = 'ANTHROPIC'): string {
  const providerName = provider === 'OPENAI' ? 'OpenAI' : 'Anthropic';
  return `No ${providerName} credential configured. Please add your ${providerName} key in Settings → AI Credentials.`;
}

export const MISSING_CREDENTIAL_ERROR = getMissingCredentialError('ANTHROPIC');

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

  return {
    provider: credential.provider,
    credentialType: credential.credentialType as 'API_KEY' | 'OAUTH_TOKEN',
    envVar: getEnvVar(credential.provider, credential.credentialType),
    secret,
    ownerUserId: credential.userId,
  };
}
