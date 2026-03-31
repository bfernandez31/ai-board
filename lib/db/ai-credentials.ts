import type { Prisma, UserAiCredential } from '@prisma/client';
import { AiCredentialProvider } from '@prisma/client';
import { prisma } from '@/lib/db/client';

export type UserAiCredentialRecord = UserAiCredential;

export async function listActiveAiCredentials(userId: string): Promise<UserAiCredentialRecord[]> {
  return prisma.userAiCredential.findMany({
    where: {
      userId,
      deletedAt: null,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });
}

export async function findActiveAiCredential(
  userId: string,
  provider: AiCredentialProvider
): Promise<UserAiCredentialRecord | null> {
  return prisma.userAiCredential.findFirst({
    where: {
      userId,
      provider,
      deletedAt: null,
    },
  });
}

export async function findProjectOwnerAiCredential(
  projectId: number,
  provider: AiCredentialProvider
): Promise<{ ownerUserId: string; credential: UserAiCredentialRecord | null } | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      userId: true,
    },
  });

  if (!project) {
    return null;
  }

  const credential = await findActiveAiCredential(project.userId, provider);

  return {
    ownerUserId: project.userId,
    credential,
  };
}

export async function upsertAiCredential(
  userId: string,
  provider: AiCredentialProvider,
  data: Omit<
    Prisma.UserAiCredentialUncheckedCreateInput,
    'userId' | 'provider' | 'createdAt' | 'updatedAt'
  >
): Promise<UserAiCredentialRecord> {
  return prisma.userAiCredential.upsert({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
    update: {
      ...data,
      deletedAt: null,
    },
    create: {
      userId,
      provider,
      ...data,
    },
  });
}

export async function softDeleteAiCredential(
  userId: string,
  provider: AiCredentialProvider,
  data: Pick<
    Prisma.UserAiCredentialUncheckedUpdateInput,
    | 'encryptedSecret'
    | 'encryptionIv'
    | 'encryptionAuthTag'
    | 'readinessStatus'
    | 'lastVerificationCode'
    | 'lastVerificationMessage'
  >
): Promise<boolean> {
  const result = await prisma.userAiCredential.updateMany({
    where: {
      userId,
      provider,
      deletedAt: null,
    },
    data: {
      ...data,
      deletedAt: new Date(),
    },
  });

  return result.count > 0;
}
