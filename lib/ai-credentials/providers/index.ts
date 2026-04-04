import type { CredentialProvider, CredentialType } from '@prisma/client';
import type { FormatValidationResult, VerificationResult } from '../types';
import * as anthropic from './anthropic';
import * as openai from './openai';

const providers: Record<
  CredentialProvider,
  {
    validateFormat: (credentialType: CredentialType, value: string) => FormatValidationResult;
    verifyWithProvider: (credentialType: CredentialType, value: string) => Promise<VerificationResult>;
  }
> = {
  ANTHROPIC: anthropic,
  OPENAI: openai,
};

export function validateFormat(
  provider: CredentialProvider,
  credentialType: CredentialType,
  value: string
): FormatValidationResult {
  return providers[provider].validateFormat(credentialType, value);
}

export async function verifyWithProvider(
  provider: CredentialProvider,
  credentialType: CredentialType,
  value: string
): Promise<VerificationResult> {
  return providers[provider].verifyWithProvider(credentialType, value);
}
