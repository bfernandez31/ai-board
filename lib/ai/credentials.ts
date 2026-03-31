import { z } from 'zod';

export const AiProviderSchema = z.enum(['ANTHROPIC']);
export const AiCredentialTypeSchema = z.enum(['API_KEY', 'OAUTH_TOKEN']);

export type AiProviderValue = z.infer<typeof AiProviderSchema>;
export type AiCredentialTypeValue = z.infer<typeof AiCredentialTypeSchema>;

export const AI_CREDENTIAL_ENV_VAR_MAP: Record<AiCredentialTypeValue, string> = {
  API_KEY: 'ANTHROPIC_API_KEY',
  OAUTH_TOKEN: 'CLAUDE_CODE_OAUTH_TOKEN',
};

const ANTHROPIC_API_KEY_PATTERN = /^sk-ant(?:-api\d+)?-[A-Za-z0-9_-]{10,}$/;
const ANTHROPIC_OAUTH_TOKEN_PATTERN = /^[A-Za-z0-9._-]{20,}$/;

export function getCredentialFormatError(
  provider: AiProviderValue,
  credentialType: AiCredentialTypeValue,
  secret: string
): string | null {
  const trimmedSecret = secret.trim();

  if (!trimmedSecret) {
    return 'Credential is required';
  }

  if (provider === 'ANTHROPIC' && credentialType === 'API_KEY') {
    return ANTHROPIC_API_KEY_PATTERN.test(trimmedSecret)
      ? null
      : 'Anthropic API keys must start with sk-ant-';
  }

  if (provider === 'ANTHROPIC' && credentialType === 'OAUTH_TOKEN') {
    return ANTHROPIC_OAUTH_TOKEN_PATTERN.test(trimmedSecret)
      ? null
      : 'OAuth tokens must be at least 20 characters and use only URL-safe characters';
  }

  return 'Unsupported AI credential type';
}

export function maskCredentialPreview(preview: string): string {
  return `****${preview}`;
}

export interface ProviderValidationResult {
  valid: boolean;
  error: string | null;
}

async function validateAnthropicApiKey(secret: string): Promise<ProviderValidationResult> {
  const response = await fetch('https://api.anthropic.com/v1/models', {
    method: 'GET',
    headers: {
      'x-api-key': secret,
      'anthropic-version': '2023-06-01',
    },
    cache: 'no-store',
  });

  if (response.ok) {
    return { valid: true, error: null };
  }

  if (response.status === 401) {
    return { valid: false, error: 'Anthropic rejected this API key' };
  }

  return {
    valid: false,
    error: `Anthropic validation failed with status ${response.status}`,
  };
}

async function validateAnthropicOAuthToken(secret: string): Promise<ProviderValidationResult> {
  if (process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true') {
    return { valid: true, error: null };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secret}`,
        'anthropic-version': '2023-06-01',
      },
      cache: 'no-store',
    });

    if (response.ok) {
      return { valid: true, error: null };
    }

    if (response.status === 401) {
      return { valid: false, error: 'Anthropic rejected this OAuth token' };
    }
  } catch {
    // Fall back below. OAuth validation support differs across Anthropic surfaces,
    // so runtime workflow execution remains the final source of truth.
  }

  return { valid: true, error: null };
}

export async function validateProviderCredential(
  provider: AiProviderValue,
  credentialType: AiCredentialTypeValue,
  secret: string
): Promise<ProviderValidationResult> {
  const formatError = getCredentialFormatError(provider, credentialType, secret);
  if (formatError) {
    return { valid: false, error: formatError };
  }

  if (process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true') {
    return { valid: true, error: null };
  }

  if (provider === 'ANTHROPIC' && credentialType === 'API_KEY') {
    return validateAnthropicApiKey(secret);
  }

  if (provider === 'ANTHROPIC' && credentialType === 'OAUTH_TOKEN') {
    return validateAnthropicOAuthToken(secret);
  }

  return { valid: false, error: 'Unsupported AI credential provider' };
}
