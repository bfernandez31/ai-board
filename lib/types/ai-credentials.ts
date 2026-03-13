import type {
  AiCredentialValidationStatus,
  AiProvider,
  Agent,
  WorkflowCredentialSource,
} from '@prisma/client';

export const AI_PROVIDERS = ['ANTHROPIC', 'OPENAI'] as const;

export type ProviderStatus = 'NOT_CONFIGURED' | 'CONFIGURED' | 'INVALID';

export interface ProviderStatusView {
  provider: AiProvider;
  status: ProviderStatus;
  validationStatus: AiCredentialValidationStatus | null;
  lastFour: string | null;
  validatedAt: string | null;
  message: string | null;
  canManage: boolean;
}

export interface ProviderValidationResult {
  provider: AiProvider;
  validationStatus: Exclude<AiCredentialValidationStatus, 'PENDING'>;
  message: string;
  validatedAt: string;
}

export interface StoredEncryptedCredential {
  encryptedKey: string;
  encryptionIv: string;
  encryptionTag: string;
  lastFour: string;
}

export interface WorkflowProviderRequirement {
  command: string;
  agent: Agent;
  providers: AiProvider[];
}

export interface WorkflowProviderRequirementFailure {
  provider: AiProvider;
  reason: 'MISSING' | 'INVALID';
  validationStatus: AiCredentialValidationStatus | null;
  message: string;
}

export interface WorkflowProviderCredential {
  provider: AiProvider;
  apiKey: string;
  lastFour: string;
  source: WorkflowCredentialSource;
}
