import type { CredentialType } from '@prisma/client';
import type { FormatValidationResult, VerificationResult } from '../types';

const MISTRAL_KEY_MIN_LENGTH = 32;
const VERIFICATION_TIMEOUT_MS = 10_000;

export function validateFormat(
  credentialType: CredentialType,
  value: string
): FormatValidationResult {
  if (credentialType !== 'API_KEY') {
    return { valid: false, error: 'Mistral only supports API_KEY credentials' };
  }

  if (!value) {
    return { valid: false, error: 'API key is required' };
  }

  if (value.length < MISTRAL_KEY_MIN_LENGTH) {
    return { valid: false, error: 'Invalid Mistral API key format: key is too short' };
  }

  if (/\s/.test(value)) {
    return { valid: false, error: 'Invalid Mistral API key format: key must not contain whitespace' };
  }

  return { valid: true };
}

export async function verifyWithProvider(
  _credentialType: CredentialType,
  value: string
): Promise<VerificationResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFICATION_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.mistral.ai/v1/models', {
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
          'Your API key was rejected by Mistral. Please verify the key in your Mistral dashboard and replace it.',
      };
    }

    if (response.status === 429) {
      return {
        readinessStatus: 'ACTION_REQUIRED',
        verificationCode: 'RATE_LIMITED',
        verificationMessage:
          'Mistral rate limit reached during verification. Please try again later.',
      };
    }

    return {
      readinessStatus: 'ACTION_REQUIRED',
      verificationCode: 'INVALID_KEY',
      verificationMessage: `Mistral returned status ${response.status}. Please check your API key.`,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        readinessStatus: 'ACTION_REQUIRED',
        verificationCode: 'UNREACHABLE',
        verificationMessage:
          'Unable to reach Mistral to verify your key (timeout). Please try again later.',
      };
    }

    return {
      readinessStatus: 'ACTION_REQUIRED',
      verificationCode: 'UNREACHABLE',
      verificationMessage:
        'Unable to reach Mistral to verify your key. Please try again later.',
    };
  } finally {
    clearTimeout(timeout);
  }
}
