import type { CredentialType } from '@prisma/client';
import type { FormatValidationResult, VerificationResult } from '../types';

const GOOGLE_API_KEY_MIN_LENGTH = 39; // AIza[35 chars]
const GOOGLE_OAUTH_TOKEN_MIN_LENGTH = 20;
const VERIFICATION_TIMEOUT_MS = 10_000;

export function validateFormat(
  credentialType: CredentialType,
  value: string
): FormatValidationResult {
  if (credentialType === 'API_KEY') {
    if (!value) {
      return { valid: false, error: 'API key is required' };
    }

    if (value.length < GOOGLE_API_KEY_MIN_LENGTH) {
      return { valid: false, error: 'Invalid Google API key format: key is too short' };
    }

    if (!value.startsWith('AIza')) {
      return { valid: false, error: 'Invalid Google API key format: must start with AIza' };
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

  return { valid: false, error: 'Unsupported credential type for Google' };
}

export async function verifyWithProvider(
  credentialType: CredentialType,
  value: string
): Promise<VerificationResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFICATION_TIMEOUT_MS);

  try {
    if (credentialType === 'API_KEY') {
      // Verify Google API key by checking available models
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': value,
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
            'Your API key was rejected by Google. Please verify the key in your Google Cloud Console and replace it.',
        };
      }

      if (response.status === 429) {
        return {
          readinessStatus: 'ACTION_REQUIRED',
          verificationCode: 'RATE_LIMITED',
          verificationMessage:
            'Google API rate limit reached during verification. Please try again later.',
        };
      }

      return {
        readinessStatus: 'ACTION_REQUIRED',
        verificationCode: 'INVALID_KEY',
        verificationMessage: `Google API returned status ${response.status}. Please check your API key.`,
      };
    }

    if (credentialType === 'OAUTH_TOKEN') {
      // Verify OAuth token by checking user info
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
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
          verificationCode: 'INVALID_TOKEN',
          verificationMessage:
            'Your OAuth token was rejected by Google. Please verify the token and replace it.',
        };
      }

      return {
        readinessStatus: 'ACTION_REQUIRED',
        verificationCode: 'INVALID_TOKEN',
        verificationMessage: `Google OAuth returned status ${response.status}. Please check your token.`,
      };
    }

    return {
      readinessStatus: 'ACTION_REQUIRED',
      verificationCode: 'UNSUPPORTED_TYPE',
      verificationMessage: 'Unsupported credential type for Google verification.',
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        readinessStatus: 'ACTION_REQUIRED',
        verificationCode: 'UNREACHABLE',
        verificationMessage:
          'Unable to reach Google to verify your credentials (timeout). Please try again later.',
      };
    }

    return {
      readinessStatus: 'ACTION_REQUIRED',
      verificationCode: 'UNREACHABLE',
      verificationMessage:
        'Unable to reach Google to verify your credentials. Please try again later.',
    };
  } finally {
    clearTimeout(timeout);
  }
}