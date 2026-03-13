import { z } from 'zod';
import type { APIProvider } from '@/lib/types/api-keys';

/** Zod schema for the save API key request body */
export const saveApiKeySchema = z.object({
  provider: z.enum(['ANTHROPIC', 'OPENAI']),
  apiKey: z.string().min(1).max(500),
  skipValidation: z.boolean().optional().default(false),
});

/** Zod schema for the validate API key request body */
export const validateApiKeySchema = z.object({
  provider: z.enum(['ANTHROPIC', 'OPENAI']),
  apiKey: z.string().min(1).max(500),
});

/**
 * Validate API key format by checking provider-specific prefixes.
 * Returns null if valid, or an error message if invalid.
 */
export function validateKeyFormat(provider: APIProvider, apiKey: string): string | null {
  const trimmed = apiKey.trim();

  if (trimmed.length === 0) {
    return 'API key cannot be empty';
  }

  switch (provider) {
    case 'ANTHROPIC':
      if (!trimmed.startsWith('sk-ant-')) {
        return "Invalid API key format. Anthropic keys must start with 'sk-ant-'";
      }
      break;
    case 'OPENAI':
      if (!trimmed.startsWith('sk-')) {
        return "Invalid API key format. OpenAI keys must start with 'sk-'";
      }
      break;
  }

  return null;
}

const VALIDATION_TIMEOUT = 10_000;

/**
 * Validate an API key against the provider's API.
 * Returns { valid, message, unreachable? }
 */
export async function validateKeyWithProvider(
  provider: APIProvider,
  apiKey: string
): Promise<{ valid: boolean; message: string; unreachable?: boolean }> {
  const trimmed = apiKey.trim();

  try {
    if (provider === 'ANTHROPIC') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': trimmed,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
        signal: AbortSignal.timeout(VALIDATION_TIMEOUT),
      });

      if (response.ok || response.status === 200) {
        return { valid: true, message: 'API key is valid' };
      }

      if (response.status === 401) {
        return { valid: false, message: 'API key is invalid or does not have required permissions' };
      }

      // 400 with "overloaded" or rate limit is still a valid key
      if (response.status === 429 || response.status === 400) {
        // If we get rate limited or bad request (but authenticated), key is valid
        const body = await response.json().catch(() => null);
        if (body?.error?.type === 'authentication_error') {
          return { valid: false, message: 'API key is invalid or does not have required permissions' };
        }
        return { valid: true, message: 'API key is valid' };
      }

      return { valid: false, message: 'API key is invalid or does not have required permissions' };
    }

    // OpenAI: GET /v1/models
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${trimmed}`,
      },
      signal: AbortSignal.timeout(VALIDATION_TIMEOUT),
    });

    if (response.ok) {
      return { valid: true, message: 'API key is valid' };
    }

    if (response.status === 401) {
      return { valid: false, message: 'API key is invalid or does not have required permissions' };
    }

    return { valid: false, message: 'API key is invalid or does not have required permissions' };
  } catch (error) {
    // Network errors, timeouts
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      return {
        valid: false,
        message: 'Could not reach the provider API. Please try again later.',
        unreachable: true,
      };
    }

    return {
      valid: false,
      message: 'Could not reach the provider API. Please try again later.',
      unreachable: true,
    };
  }
}
