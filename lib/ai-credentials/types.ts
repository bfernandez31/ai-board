import type { CredentialProvider, CredentialType, CredentialReadiness, Agent } from '@prisma/client';

export interface WorkflowCredentialRequest {
  projectId: number;
  provider: CredentialProvider;
}

export interface WorkflowResolvedCredential {
  provider: CredentialProvider;
  credentialType: 'API_KEY' | 'OAUTH_TOKEN';
  envVar: string;
  secret: string;
  ownerUserId: string;
}

export interface CredentialListItem {
  id: number;
  provider: CredentialProvider;
  credentialType: CredentialType;
  label: string;
  preview: string;
  readinessStatus: CredentialReadiness;
  lastVerifiedAt: Date | null;
  verificationCode: string | null;
  verificationMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCredentialInput {
  provider: CredentialProvider;
  credentialType: CredentialType;
  label: string;
  value: string;
}

export interface EncryptedCredentialData {
  encryptedValue: string;
  iv: string;
  authTag: string;
  preview: string;
}

export interface VerificationResult {
  readinessStatus: CredentialReadiness;
  verificationCode: string;
  verificationMessage: string | null;
}

export interface FormatValidationResult {
  valid: boolean;
  error?: string;
}

export const PROVIDER_ENV_VAR_MAP: Record<CredentialProvider, Record<string, string>> = {
  ANTHROPIC: {
    API_KEY: 'ANTHROPIC_API_KEY',
    OAUTH_TOKEN: 'CLAUDE_CODE_OAUTH_TOKEN',
  },
  OPENAI: {
    API_KEY: 'OPENAI_API_KEY',
  },
};

export const AGENT_PROVIDER_MAP: Record<Agent, CredentialProvider> = {
  CLAUDE: 'ANTHROPIC',
  CODEX: 'OPENAI',
};
