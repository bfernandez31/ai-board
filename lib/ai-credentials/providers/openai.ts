import type { CredentialType } from '@prisma/client';
import type { FormatValidationResult, VerificationResult } from '../types';

const OPENAI_KEY_PREFIX = 'sk-';
const OPENAI_KEY_MIN_LENGTH = 20;
const VERIFICATION_TIMEOUT_MS = 10_000;

export function validateFormat(
  credentialType: CredentialType,
  value: string
): FormatValidationResult {
  if (credentialType === 'OAUTH_TOKEN') {
    if (!value || value.length < 1) {
      return { valid: false, error: 'Token value is required' };
    }
    return { valid: true };
  }

  if (credentialType === 'API_KEY') {
    if (!value.startsWith(OPENAI_KEY_PREFIX)) {
      return { valid: false, error: 'Invalid OpenAI API key format: must start with "sk-"' };
    }
    if (value.length < OPENAI_KEY_MIN_LENGTH) {
      return { valid: false, error: 'Invalid OpenAI API key format: key is too short' };
    }
    return { valid: true };
  }

  return { valid: false, error: 'Unsupported credential type' };
}

export async function verifyWithProvider(
  _credentialType: CredentialType,
  value: string
): Promise<VerificationResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFICATION_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${value}`,
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
          'Your API key was rejected by OpenAI. Please verify the key in your OpenAI dashboard and replace it.',
      };
    }

    if (response.status === 429) {
      return {
        readinessStatus: 'ACTION_REQUIRED',
        verificationCode: 'RATE_LIMITED',
        verificationMessage:
          'OpenAI rate limit reached during verification. Please try again later.',
      };
    }

    return {
      readinessStatus: 'ACTION_REQUIRED',
      verificationCode: 'INVALID_KEY',
      verificationMessage: `OpenAI returned status ${response.status}. Please check your API key.`,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        readinessStatus: 'ACTION_REQUIRED',
        verificationCode: 'UNREACHABLE',
        verificationMessage:
          'Unable to reach OpenAI to verify your key (timeout). Please try again later.',
      };
    }

    return {
      readinessStatus: 'ACTION_REQUIRED',
      verificationCode: 'UNREACHABLE',
      verificationMessage:
        'Unable to reach OpenAI to verify your key. Please try again later.',
    };
  } finally {
    clearTimeout(timeout);
  }
}
