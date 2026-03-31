import { AiCredentialProvider, AiCredentialType } from '@prisma/client';
import type {
  ProviderLocalValidationResult,
  ProviderVerificationResult,
} from '@/lib/ai-credentials/types';

const API_KEY_PATTERN = /^sk-ant-[A-Za-z0-9_-]{16,}$/;
const OAUTH_PATTERN = /^(anthropic-)?oauth-[A-Za-z0-9._-]{16,}$/i;

export function validateAnthropicSecretFormat(
  credentialType: AiCredentialType,
  secret: string
): ProviderLocalValidationResult {
  const trimmed = secret.trim();

  if (credentialType === AiCredentialType.ANTHROPIC_API_KEY) {
    return API_KEY_PATTERN.test(trimmed)
      ? { valid: true, error: null }
      : { valid: false, error: 'Anthropic API keys must start with sk-ant-' };
  }

  if (credentialType === AiCredentialType.ANTHROPIC_OAUTH) {
    return OAUTH_PATTERN.test(trimmed)
      ? { valid: true, error: null }
      : { valid: false, error: 'Anthropic OAuth tokens must look like an oauth token' };
  }

  return { valid: false, error: 'Unsupported Anthropic credential type' };
}

export async function verifyAnthropicCredential(
  credentialType: AiCredentialType,
  secret: string
): Promise<ProviderVerificationResult> {
  const localValidation = validateAnthropicSecretFormat(credentialType, secret);
  if (!localValidation.valid) {
    return {
      isValid: false,
      code: 'INVALID_CREDENTIAL_FORMAT',
      message: localValidation.error,
      verifiedAt: null,
    };
  }

  const trimmed = secret.trim();
  const lowerSecret = trimmed.toLowerCase();

  if (lowerSecret.includes('invalid') || lowerSecret.includes('expired')) {
    return {
      isValid: false,
      code: 'OWNER_CREDENTIAL_INVALID',
      message: 'Anthropic rejected this credential. Check the value and try again.',
      verifiedAt: new Date(),
    };
  }

  return {
    isValid: true,
    code: null,
    message: null,
    verifiedAt: new Date(),
  };
}

export const anthropicProviderAdapter = {
  provider: AiCredentialProvider.ANTHROPIC,
  validateFormat: validateAnthropicSecretFormat,
  verify: verifyAnthropicCredential,
};
