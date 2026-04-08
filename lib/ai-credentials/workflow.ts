import { prisma } from '@/lib/db/client';
import { decryptCredential, encryptCredential } from './crypto';
import { getEnvVar, type WorkflowResolvedCredential } from './types';
import type {
  Agent,
  CredentialProvider,
  CredentialReadiness,
  UserCredential,
} from '@prisma/client';

export function getMissingCredentialError(provider: CredentialProvider = 'ANTHROPIC'): string {
  const providerName = provider === 'OPENAI' ? 'OpenAI' : 'Anthropic';
  return `No ${providerName} credential configured. Please add your ${providerName} key in Settings → AI Credentials.`;
}

export const MISSING_CREDENTIAL_ERROR = getMissingCredentialError('ANTHROPIC');

export const AGENT_PROVIDER_MAP: Record<Agent, CredentialProvider> = {
  CLAUDE: 'ANTHROPIC',
  CODEX: 'OPENAI',
};

export type CredentialReadinessStatus = CredentialReadiness | 'MISSING';

export interface CredentialReadinessResult {
  provider: CredentialProvider;
  ready: boolean;
  readinessStatus: CredentialReadinessStatus;
  message: string;
}

export function getProviderForAgent(agent: Agent): CredentialProvider {
  return AGENT_PROVIDER_MAP[agent];
}

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

export async function getOwnerCredentialReadiness(
  projectId: number,
  agent: Agent
): Promise<CredentialReadinessResult> {
  const provider = getProviderForAgent(agent);
  const credential = await getOwnerCredential(projectId, provider);

  if (!credential) {
    return {
      provider,
      ready: false,
      readinessStatus: 'MISSING',
      message: getMissingCredentialError(provider),
    };
  }

  return {
    provider,
    ready: credential.readinessStatus === 'READY',
    readinessStatus: credential.readinessStatus,
    message:
      credential.readinessStatus === 'READY'
        ? `${provider === 'OPENAI' ? 'OpenAI' : 'Anthropic'} credential is ready.`
        : credential.verificationMessage ||
          `The ${provider === 'OPENAI' ? 'OpenAI' : 'Anthropic'} credential needs attention before setup can start.`,
  };
}

export async function updateOwnerCredential(
  projectId: number,
  provider: CredentialProvider,
  plaintext: string
): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });

  if (!project) return false;

  const existing = await prisma.userCredential.findFirst({
    where: { userId: project.userId, provider },
  });

  if (!existing) return false;

  const encrypted = encryptCredential(plaintext);

  await prisma.userCredential.update({
    where: { id: existing.id },
    data: {
      encryptedValue: encrypted.encryptedValue,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      preview: encrypted.preview,
      updatedAt: new Date(),
    },
  });

  return true;
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
