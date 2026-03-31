import { AiProvider, CredentialType } from '@prisma/client';

/** Format validation for API keys by provider and credential type */
export function validateKeyFormat(
  provider: AiProvider,
  credentialType: CredentialType,
  key: string
): { valid: boolean; error?: string } {
  if (!key || key.trim().length === 0) {
    return { valid: false, error: 'API key is required' };
  }

  if (provider === 'ANTHROPIC') {
    if (credentialType === 'API_KEY') {
      if (!key.startsWith('sk-ant-')) {
        return { valid: false, error: 'Anthropic API key must start with "sk-ant-"' };
      }
      if (key.length < 20) {
        return { valid: false, error: 'Anthropic API key is too short' };
      }
    }
    // OAuth tokens have no strict format constraint
    if (credentialType === 'OAUTH_TOKEN') {
      if (key.length < 10) {
        return { valid: false, error: 'OAuth token is too short' };
      }
    }
  }

  return { valid: true };
}

/**
 * Server-side validation: call the provider API to verify the key works.
 * Returns true if the key is valid, or an error message if not.
 */
export async function validateKeyWithProvider(
  provider: AiProvider,
  credentialType: CredentialType,
  key: string
): Promise<{ valid: boolean; error?: string }> {
  if (provider === 'ANTHROPIC') {
    try {
      // Use the models endpoint as a lightweight validation check
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      };

      if (credentialType === 'API_KEY') {
        headers['x-api-key'] = key;
      } else {
        headers['Authorization'] = `Bearer ${key}`;
      }

      const response = await fetch('https://api.anthropic.com/v1/models', {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        return { valid: true };
      }

      if (response.status === 401) {
        return { valid: false, error: 'Invalid API key: authentication failed' };
      }

      if (response.status === 403) {
        return { valid: false, error: 'API key does not have sufficient permissions' };
      }

      return { valid: false, error: `Provider returned status ${response.status}` };
    } catch {
      return { valid: false, error: 'Could not reach Anthropic API to validate key' };
    }
  }

  return { valid: true };
}
