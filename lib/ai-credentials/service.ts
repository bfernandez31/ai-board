import {
  AiCredentialProvider,
  AiCredentialReadinessStatus,
  type UserAiCredential,
} from '@prisma/client';
import { decryptSecret, encryptSecret, maskSecret, shredSecretFields } from '@/lib/ai-credentials/crypto';
import { anthropicProviderAdapter } from '@/lib/ai-credentials/providers/anthropic';
import type {
  UpsertAiCredentialInput,
  UserAiCredentialSummary,
} from '@/lib/ai-credentials/types';
import {
  findActiveAiCredential,
  listActiveAiCredentials,
  softDeleteAiCredential,
  upsertAiCredential,
} from '@/lib/db/ai-credentials';

function toSummary(credential: UserAiCredential): UserAiCredentialSummary {
  return {
    provider: credential.provider,
    credentialType: credential.credentialType,
    label: credential.label,
    maskedPreview: credential.maskedPreview,
    readinessStatus: credential.readinessStatus,
    lastVerifiedAt: credential.lastVerifiedAt?.toISOString() ?? null,
    lastVerificationCode: credential.lastVerificationCode,
    lastVerificationMessage: credential.lastVerificationMessage,
    updatedAt: credential.updatedAt.toISOString(),
  };
}

function getProviderAdapter(provider: AiCredentialProvider) {
  if (provider === AiCredentialProvider.ANTHROPIC) {
    return anthropicProviderAdapter;
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

export async function listCredentialSummaries(userId: string): Promise<UserAiCredentialSummary[]> {
  const credentials = await listActiveAiCredentials(userId);
  return credentials.map(toSummary);
}

export async function getCredentialSummary(
  userId: string,
  provider: AiCredentialProvider
): Promise<UserAiCredentialSummary | null> {
  const credential = await findActiveAiCredential(userId, provider);
  return credential ? toSummary(credential) : null;
}

export async function saveUserAiCredential(
  userId: string,
  input: UpsertAiCredentialInput
): Promise<UserAiCredentialSummary> {
  const adapter = getProviderAdapter(input.provider);
  const verification = await adapter.verify(input.credentialType, input.secret);
  const encrypted = encryptSecret(input.secret);
  const readinessStatus = verification.isValid
    ? AiCredentialReadinessStatus.READY
    : AiCredentialReadinessStatus.ACTION_REQUIRED;

  const credential = await upsertAiCredential(userId, input.provider, {
    credentialType: input.credentialType,
    label: input.label.trim(),
    maskedPreview: maskSecret(input.secret),
    ...encrypted,
    readinessStatus,
    lastVerifiedAt: verification.verifiedAt,
    lastVerificationCode: verification.code,
    lastVerificationMessage: verification.message,
  });

  return toSummary(credential);
}

export async function deleteUserAiCredential(
  userId: string,
  provider: AiCredentialProvider
): Promise<boolean> {
  return softDeleteAiCredential(userId, provider, {
    ...shredSecretFields(),
    readinessStatus: AiCredentialReadinessStatus.ACTION_REQUIRED,
    lastVerificationCode: 'DELETED',
    lastVerificationMessage: 'Credential deleted',
  });
}

export async function resolveCredentialSecret(
  credential: Pick<
    UserAiCredential,
    'encryptedSecret' | 'encryptionIv' | 'encryptionAuthTag'
  >
): Promise<string> {
  return decryptSecret(credential);
}
