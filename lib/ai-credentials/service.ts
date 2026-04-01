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

  const data = {
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
  };

  return prisma.userCredential.upsert({
    where: {
      userId_provider: {
        userId,
        provider: input.provider,
      },
    },
    create: { userId, provider: input.provider, ...data },
    update: data,
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

  const credentialType = credential.credentialType as 'API_KEY' | 'OAUTH_TOKEN';
  const formatResult = validateFormat(credentialType, decrypted);

  const result: VerificationResult = formatResult.valid
    ? await verifyWithProvider(credentialType, decrypted)
    : {
        readinessStatus: 'ACTION_REQUIRED',
        verificationCode: 'INVALID_KEY',
        verificationMessage: formatResult.error || 'Stored credential has invalid format.',
      };

  await prisma.userCredential.update({
    where: { id },
    data: {
      readinessStatus: result.readinessStatus as CredentialReadiness,
      verificationCode: result.verificationCode,
      verificationMessage: result.verificationMessage,
      ...(result.verificationCode !== 'UNREACHABLE' && { lastVerifiedAt: new Date() }),
    },
  });

  return result;
}
