import { prisma } from '@/lib/db/client';
import { decryptCredential } from './crypto';
import { ENV_VAR_MAP } from './types';
import type { WorkflowResolvedCredential } from './types';
import type { UserCredential } from '@prisma/client';

export const MISSING_CREDENTIAL_ERROR =
  'No AI credential configured. Please add your Anthropic key in Settings → AI Credentials.';

export async function getOwnerCredential(
  projectId: number
): Promise<UserCredential | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });

  if (!project) return null;

  return prisma.userCredential.findFirst({
    where: {
      userId: project.userId,
      provider: 'ANTHROPIC',
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
    provider: 'ANTHROPIC',
    credentialType: credential.credentialType as 'API_KEY' | 'OAUTH_TOKEN',
    envVar: ENV_VAR_MAP[credential.credentialType],
    secret,
    ownerUserId: credential.userId,
  };
}
