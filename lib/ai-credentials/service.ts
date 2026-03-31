import { prisma } from '@/lib/db/client';
import type { CredentialProvider, CredentialReadiness } from '@prisma/client';
import { encryptCredential, decryptCredential } from './crypto';
import { validateFormat, verifyWithProvider } from './providers/anthropic';
import type { CreateCredentialInput, CredentialListItem, VerificationResult } from './types';

const CREDENTIAL_SELECT = {
  id: true,
  provider: true,
  credentialType: true,
  label: true,
  preview: true,
  readinessStatus: true,
  lastVerifiedAt: true,
  verificationCode: true,
  verificationMessage: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function createOrReplaceCredential(
  userId: string,
  input: CreateCredentialInput,
  verificationResult: VerificationResult
): Promise<CredentialListItem> {
  const { encryptedValue, iv, authTag, preview } = encryptCredential(input.value);

  return prisma.userCredential.upsert({
    where: {
      userId_provider: {
        userId,
        provider: input.provider,
      },
    },
    create: {
      userId,
      provider: input.provider,
      credentialType: input.credentialType,
      label: input.label,
      encryptedValue,
      iv,
      authTag,
      preview,
      readinessStatus: verificationResult.readinessStatus as CredentialReadiness,
      lastVerifiedAt: new Date(),
      verificationCode: verificationResult.verificationCode,
      verificationMessage: verificationResult.verificationMessage,
    },
    update: {
      credentialType: input.credentialType,
      label: input.label,
      encryptedValue,
      iv,
      authTag,
      preview,
      readinessStatus: verificationResult.readinessStatus as CredentialReadiness,
      lastVerifiedAt: new Date(),
      verificationCode: verificationResult.verificationCode,
      verificationMessage: verificationResult.verificationMessage,
    },
    select: CREDENTIAL_SELECT,
  });
}

export async function listCredentials(userId: string): Promise<CredentialListItem[]> {
  return prisma.userCredential.findMany({
    where: { userId },
    select: CREDENTIAL_SELECT,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getCredentialForDecryption(
  id: number,
  userId: string
): Promise<{
  id: number;
  provider: CredentialProvider;
  credentialType: string;
  encryptedValue: string;
  iv: string;
  authTag: string;
} | null> {
  return prisma.userCredential.findFirst({
    where: { id, userId },
    select: {
      id: true,
      provider: true,
      credentialType: true,
      encryptedValue: true,
      iv: true,
      authTag: true,
    },
  });
}

export async function deleteCredential(id: number, userId: string): Promise<boolean> {
  const credential = await prisma.userCredential.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!credential) return false;

  await prisma.userCredential.delete({ where: { id } });
  return true;
}

export async function testCredential(
  id: number,
  userId: string
): Promise<VerificationResult | null> {
  const credential = await getCredentialForDecryption(id, userId);
  if (!credential) return null;

  const decrypted = decryptCredential(
    credential.encryptedValue,
    credential.iv,
    credential.authTag
  );

  const formatResult = validateFormat(credential.credentialType as 'API_KEY' | 'OAUTH_TOKEN', decrypted);
  if (!formatResult.valid) {
    const result: VerificationResult = {
      readinessStatus: 'ACTION_REQUIRED',
      verificationCode: 'INVALID_KEY',
      verificationMessage: formatResult.error || 'Stored credential has invalid format.',
    };

    await prisma.userCredential.update({
      where: { id },
      data: {
        readinessStatus: result.readinessStatus,
        lastVerifiedAt: new Date(),
        verificationCode: result.verificationCode,
        verificationMessage: result.verificationMessage,
      },
    });

    return result;
  }

  const result = await verifyWithProvider(
    credential.credentialType as 'API_KEY' | 'OAUTH_TOKEN',
    decrypted
  );

  const updateData: {
    readinessStatus: CredentialReadiness;
    lastVerifiedAt?: Date;
    verificationCode: string;
    verificationMessage: string | null;
  } = {
    readinessStatus: result.readinessStatus as CredentialReadiness,
    verificationCode: result.verificationCode,
    verificationMessage: result.verificationMessage,
  };

  if (result.verificationCode !== 'UNREACHABLE') {
    updateData.lastVerifiedAt = new Date();
  }

  await prisma.userCredential.update({
    where: { id },
    data: updateData,
  });

  return result;
}
