import {
  AiCredentialProvider,
  AiCredentialReadinessStatus,
  AiCredentialType,
} from '@prisma/client';

export {
  AiCredentialProvider,
  AiCredentialReadinessStatus,
  AiCredentialType,
};

export const AI_CREDENTIAL_PROVIDER_LABELS: Record<AiCredentialProvider, string> = {
  [AiCredentialProvider.ANTHROPIC]: 'Anthropic',
};

export const AI_CREDENTIAL_TYPE_LABELS: Record<AiCredentialType, string> = {
  [AiCredentialType.ANTHROPIC_API_KEY]: 'API key',
  [AiCredentialType.ANTHROPIC_OAUTH]: 'OAuth token',
};

export interface UserAiCredentialSummary {
  provider: AiCredentialProvider;
  credentialType: AiCredentialType;
  label: string;
  maskedPreview: string;
  readinessStatus: AiCredentialReadinessStatus;
  lastVerifiedAt: string | null;
  lastVerificationCode: string | null;
  lastVerificationMessage: string | null;
  updatedAt: string;
}

export interface DeleteAiCredentialResponse {
  deleted: true;
}

export interface UpsertAiCredentialInput {
  provider: AiCredentialProvider;
  credentialType: AiCredentialType;
  label: string;
  secret: string;
}

export interface WorkflowResolvedCredential {
  provider: AiCredentialProvider;
  credentialType: AiCredentialType;
  authMode: 'api-key' | 'oauth-token';
  secret: string;
  ownerUserId: string;
  resolvedAt: string;
}

export interface OwnerCredentialEligibility {
  eligible: boolean;
  code:
    | 'READY'
    | 'OWNER_CREDENTIAL_MISSING'
    | 'OWNER_CREDENTIAL_ACTION_REQUIRED'
    | 'CREDENTIAL_RETRIEVAL_FAILED';
  message: string;
}

export interface ProviderVerificationResult {
  isValid: boolean;
  code: string | null;
  message: string | null;
  verifiedAt: Date | null;
}

export interface ProviderLocalValidationResult {
  valid: boolean;
  error: string | null;
}

export interface AiCredentialProviderMetadata {
  provider: AiCredentialProvider;
  label: string;
  supportedTypes: Array<{
    value: AiCredentialType;
    label: string;
  }>;
}

export const AI_CREDENTIAL_PROVIDERS: AiCredentialProviderMetadata[] = [
  {
    provider: AiCredentialProvider.ANTHROPIC,
    label: AI_CREDENTIAL_PROVIDER_LABELS[AiCredentialProvider.ANTHROPIC],
    supportedTypes: [
      {
        value: AiCredentialType.ANTHROPIC_API_KEY,
        label: AI_CREDENTIAL_TYPE_LABELS[AiCredentialType.ANTHROPIC_API_KEY],
      },
      {
        value: AiCredentialType.ANTHROPIC_OAUTH,
        label: AI_CREDENTIAL_TYPE_LABELS[AiCredentialType.ANTHROPIC_OAUTH],
      },
    ],
  },
];

export function parseAiCredentialProvider(
  provider: string
): AiCredentialProvider | null {
  const normalizedProvider = provider.toLowerCase();

  if (normalizedProvider === 'anthropic') {
    return AiCredentialProvider.ANTHROPIC;
  }

  return null;
}
