import { AiCredentialType, AiProvider, type UserAiCredential } from '@prisma/client';
import { maskCredentialPreview } from '@/lib/ai/credentials';
import { prisma } from '@/lib/db/client';
import { decryptSecret, encryptSecret } from '@/lib/security/secret-box';

export interface UserAiCredentialView {
  id: number;
  provider: AiProvider;
  credentialType: AiCredentialType;
  label: string;
  preview: string;
  lastValidatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function toViewModel(credential: UserAiCredential): UserAiCredentialView {
  return {
    id: credential.id,
    provider: credential.provider,
    credentialType: credential.credentialType,
    label: credential.label,
    preview: maskCredentialPreview(credential.preview),
    lastValidatedAt: credential.lastValidatedAt?.toISOString() ?? null,
    createdAt: credential.createdAt.toISOString(),
    updatedAt: credential.updatedAt.toISOString(),
  };
}

export async function listUserAiCredentials(userId: string): Promise<UserAiCredentialView[]> {
  const credentials = await prisma.userAiCredential.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });

  return credentials.map(toViewModel);
}

export async function upsertUserAiCredential(input: {
  userId: string;
  provider: AiProvider;
  credentialType: AiCredentialType;
  label: string;
  secret: string;
  lastValidatedAt?: Date;
}): Promise<UserAiCredentialView> {
  const trimmedSecret = input.secret.trim();
  const encrypted = encryptSecret(trimmedSecret);
  const preview = trimmedSecret.slice(-4);

  const credential = await prisma.userAiCredential.upsert({
    where: {
      userId_provider: {
        userId: input.userId,
        provider: input.provider,
      },
    },
    update: {
      credentialType: input.credentialType,
      label: input.label,
      encryptedValue: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      preview,
      lastValidatedAt: input.lastValidatedAt ?? new Date(),
    },
    create: {
      userId: input.userId,
      provider: input.provider,
      credentialType: input.credentialType,
      label: input.label,
      encryptedValue: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      preview,
      lastValidatedAt: input.lastValidatedAt ?? new Date(),
    },
  });

  return toViewModel(credential);
}

export async function deleteUserAiCredential(userId: string, provider: AiProvider): Promise<boolean> {
  const result = await prisma.userAiCredential.deleteMany({
    where: {
      userId,
      provider,
    },
  });

  return result.count > 0;
}

export async function getProjectOwnerAiCredential(projectId: number): Promise<{
  provider: AiProvider;
  credentialType: AiCredentialType;
  secret: string;
  label: string;
} | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  const credential = await prisma.userAiCredential.findFirst({
    where: {
      userId: project.userId,
      provider: AiProvider.ANTHROPIC,
    },
  });

  if (!credential) {
    return null;
  }

  return {
    provider: credential.provider,
    credentialType: credential.credentialType,
    label: credential.label,
    secret: decryptSecret({
      ciphertext: credential.encryptedValue,
      iv: credential.iv,
      authTag: credential.authTag,
    }),
  };
}

export async function projectOwnerHasAiCredential(projectId: number): Promise<boolean> {
  const credential = await getProjectOwnerAiCredential(projectId);
  return credential !== null;
}
