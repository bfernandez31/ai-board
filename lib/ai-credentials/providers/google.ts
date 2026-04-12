import type { CredentialType } from '@prisma/client';
import type { FormatValidationResult, VerificationResult } from '../types';

const VERIFICATION_TIMEOUT_MS = 10_000;

function isJSONObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseOAuthBundle(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return isJSONObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function validateFormat(
  credentialType: CredentialType,
  value: string
): FormatValidationResult {
  if (credentialType === 'API_KEY') {
    if (!value.trim()) {
      return { valid: false, error: 'API key is required' };
    }
    if (/\s/.test(value)) {
      return { valid: false, error: 'Google API key must not contain whitespace' };
    }
    if (value.length < 20) {
      return { valid: false, error: 'Google API key appears too short' };
    }
    return { valid: true };
  }

  if (credentialType === 'OAUTH_TOKEN') {
    const parsed = parseOAuthBundle(value);
    if (!parsed) {
      return { valid: false, error: 'Google OAuth bundle must be valid JSON' };
    }

    const hasRefreshToken = typeof parsed.refresh_token === 'string';
    const hasAccessToken = typeof parsed.access_token === 'string';
    const hasCredentialEnvelope =
      isJSONObject(parsed.credentials) ||
      isJSONObject(parsed.auth) ||
      isJSONObject(parsed.tokens);

    if (!hasRefreshToken && !hasAccessToken && !hasCredentialEnvelope) {
      return {
        valid: false,
        error: 'Google OAuth bundle must include cached Gemini authentication data',
      };
    }

    return { valid: true };
  }

  return { valid: false, error: 'Unsupported credential type' };
}

export async function verifyWithProvider(
  credentialType: CredentialType,
  value: string
): Promise<VerificationResult> {
  if (credentialType === 'OAUTH_TOKEN') {
    const format = validateFormat(credentialType, value);
    return format.valid
      ? {
          readinessStatus: 'READY',
          verificationCode: 'VALID',
          verificationMessage: null,
        }
      : {
          readinessStatus: 'ACTION_REQUIRED',
          verificationCode: 'INVALID_BUNDLE',
          verificationMessage: format.error ?? 'Invalid Gemini OAuth bundle',
        };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFICATION_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(value)}`,
      {
        method: 'GET',
        signal: controller.signal,
      }
    );

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
          'Your Google API key was rejected. Verify the Gemini API key in Google AI Studio and replace it.',
      };
    }

    if (response.status === 429) {
      return {
        readinessStatus: 'ACTION_REQUIRED',
        verificationCode: 'RATE_LIMITED',
        verificationMessage:
          'Google rate limited credential verification. Try again later.',
      };
    }

    return {
      readinessStatus: 'ACTION_REQUIRED',
      verificationCode: 'INVALID_KEY',
      verificationMessage: `Google returned status ${response.status}. Please check your Gemini API key.`,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        readinessStatus: 'ACTION_REQUIRED',
        verificationCode: 'UNREACHABLE',
        verificationMessage:
          'Unable to reach Google to verify your Gemini API key (timeout). Please try again later.',
      };
    }

    return {
      readinessStatus: 'ACTION_REQUIRED',
      verificationCode: 'UNREACHABLE',
      verificationMessage:
        'Unable to reach Google to verify your Gemini API key. Please try again later.',
    };
  } finally {
    clearTimeout(timeout);
  }
}
