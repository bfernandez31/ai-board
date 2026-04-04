import type { CredentialProvider, CredentialType } from '@prisma/client';
import type { FormatValidationResult, VerificationResult } from '../types';
import * as anthropic from './anthropic';
import * as openai from './openai';

export interface ProviderModule {
  validateFormat(credentialType: CredentialType, value: string): FormatValidationResult;
  verifyWithProvider(credentialType: CredentialType, value: string): Promise<VerificationResult>;
}

const PROVIDER_MODULES: Record<CredentialProvider, ProviderModule> = {
  ANTHROPIC: anthropic,
  OPENAI: openai,
};

export function getProviderModule(provider: CredentialProvider): ProviderModule {
  const mod = PROVIDER_MODULES[provider];
  if (!mod) {
    throw new Error(`Unsupported credential provider: ${provider}`);
  }
  return mod;
}
