import type { CredentialType } from '@prisma/client';
import type { FormatValidationResult, VerificationResult } from '../types';

const API_KEY_REGEX = /^sk-ant-api\d{2}-[A-Za-z0-9_-]{80,}$/;
const OAUTH_TOKEN_MIN_LENGTH = 20;
const VERIFICATION_TIMEOUT_MS = 10_000;

export function validateFormat(
  credentialType: CredentialType,
  value: string
): FormatValidationResult {
  if (credentialType === 'API_KEY') {
    if (!API_KEY_REGEX.test(value)) {
      return { valid: false, error: 'Invalid Anthropic API key format' };
    }
    return { valid: true };
  }

  if (credentialType === 'OAUTH_TOKEN') {
    if (!value || value.length < OAUTH_TOKEN_MIN_LENGTH) {
      return { valid: false, error: 'Invalid OAuth token format' };
    }
    return { valid: true };
  }

  return { valid: false, error: 'Unsupported credential type' };
}

export async function verifyWithProvider(
  credentialType: CredentialType,
  value: string
): Promise<VerificationResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFICATION_TIMEOUT_MS);

  try {
    if (credentialType === 'API_KEY') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': value,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
        signal: controller.signal,
      });

      if (response.ok) {
        return {
          readinessStatus: 'READY',
          verificationCode: 'VALID',
          verificationMessage: null,
        };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          readinessStatus: 'ACTION_REQUIRED',
          verificationCode: 'INVALID_KEY',
          verificationMessage:
            'Your API key was rejected by Anthropic. Please verify the key in your Anthropic console and replace it.',
        };
      }

      if (response.status === 429) {
        return {
          readinessStatus: 'ACTION_REQUIRED',
          verificationCode: 'RATE_LIMITED',
          verificationMessage:
            'Anthropic rate limit reached during verification. Please try again later.',
        };
      }

      return {
        readinessStatus: 'ACTION_REQUIRED',
        verificationCode: 'INVALID_KEY',
        verificationMessage: `Anthropic returned status ${response.status}. Please check your API key.`,
      };
    }

    // OAUTH_TOKEN: verify by listing models
    const response = await fetch('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${value}`,
        'anthropic-version': '2023-06-01',
      },
      signal: controller.signal,
    });

    if (response.ok) {
      return {
        readinessStatus: 'READY',
        verificationCode: 'VALID',
        verificationMessage: null,
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        readinessStatus: 'ACTION_REQUIRED',
        verificationCode: 'INVALID_KEY',
        verificationMessage:
          'Your OAuth token was rejected by Anthropic. Please verify the token and replace it.',
      };
    }

    return {
      readinessStatus: 'ACTION_REQUIRED',
      verificationCode: 'INVALID_KEY',
      verificationMessage: `Anthropic returned status ${response.status}. Please check your OAuth token.`,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        readinessStatus: 'ACTION_REQUIRED',
        verificationCode: 'UNREACHABLE',
        verificationMessage:
          'Unable to reach Anthropic to verify your key (timeout). Please try again later.',
      };
    }

    return {
      readinessStatus: 'ACTION_REQUIRED',
      verificationCode: 'UNREACHABLE',
      verificationMessage:
        'Unable to reach Anthropic to verify your key. Please try again later.',
    };
  } finally {
    clearTimeout(timeout);
  }
}
