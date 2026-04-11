import type { CredentialType } from '@prisma/client';
import type { FormatValidationResult, VerificationResult } from '../types';

const GOOGLE_API_KEY_MIN_LENGTH = 39;
const GOOGLE_API_KEY_PREFIX = 'AIza';
const GOOGLE_OAUTH_TOKEN_MIN_LENGTH = 20;
const VERIFICATION_TIMEOUT_MS = 10_000;
const GOOGLE_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export function validateFormat(
  credentialType: CredentialType,
  value: string
): FormatValidationResult {
  if (credentialType === 'API_KEY') {
    if (!value) {
      return { valid: false, error: 'API key is required' };
    }

    if (!value.startsWith(GOOGLE_API_KEY_PREFIX)) {
      return { valid: false, error: 'Invalid Google API key format: key must start with "AIza"' };
    }

    if (value.length < GOOGLE_API_KEY_MIN_LENGTH) {
      return { valid: false, error: 'Invalid Google API key format: key is too short' };
    }

    if (/\s/.test(value)) {
      return { valid: false, error: 'Invalid Google API key format: key must not contain whitespace' };
    }

    return { valid: true };
  }

  if (credentialType === 'OAUTH_TOKEN') {
    if (!value) {
      return { valid: false, error: 'OAuth token is required' };
    }

    if (value.length < GOOGLE_OAUTH_TOKEN_MIN_LENGTH) {
      return { valid: false, error: 'Invalid Google OAuth token format: token is too short' };
    }

    if (/\s/.test(value)) {
      return { valid: false, error: 'Invalid Google OAuth token format: token must not contain whitespace' };
    }

    return { valid: true };
  }

  return { valid: false, error: `Unsupported credential type: ${credentialType}` };
}

export async function verifyWithProvider(
  credentialType: CredentialType,
  value: string
): Promise<VerificationResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFICATION_TIMEOUT_MS);

  try {
    const url =
      credentialType === 'API_KEY'
        ? `${GOOGLE_MODELS_URL}?key=${value}`
        : GOOGLE_MODELS_URL;

    const headers: Record<string, string> =
      credentialType === 'OAUTH_TOKEN'
        ? { Authorization: `Bearer ${value}` }
        : {};

    const response = await fetch(url, {
      method: 'GET',
      headers,
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
          'Your credential was rejected by Google. Please verify it in your Google AI Studio dashboard and replace it.',
      };
    }

    if (response.status === 429) {
      return {
        readinessStatus: 'ACTION_REQUIRED',
        verificationCode: 'RATE_LIMITED',
        verificationMessage:
          'Google rate limit reached during verification. Please try again later.',
      };
    }

    return {
      readinessStatus: 'ACTION_REQUIRED',
      verificationCode: 'INVALID_KEY',
      verificationMessage: `Google returned status ${response.status}. Please check your credential.`,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        readinessStatus: 'ACTION_REQUIRED',
        verificationCode: 'UNREACHABLE',
        verificationMessage:
          'Unable to reach Google to verify your credential (timeout). Please try again later.',
      };
    }

    return {
      readinessStatus: 'ACTION_REQUIRED',
      verificationCode: 'UNREACHABLE',
      verificationMessage:
        'Unable to reach Google to verify your credential. Please try again later.',
    };
  } finally {
    clearTimeout(timeout);
  }
}
