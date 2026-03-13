import crypto from 'crypto';
import { Agent } from '@prisma/client';

export type ProjectApiKeyProvider = 'anthropic' | 'openai';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

export interface ProjectApiKeySummary {
  configured: boolean;
  maskedValue: string | null;
  preview: string | null;
}

export interface ProjectApiKeysState {
  anthropic: ProjectApiKeySummary;
  openai: ProjectApiKeySummary;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  message: string;
}

function getEncryptionKey(): Buffer {
  const secret =
    process.env.PROJECT_SECRET_ENCRYPTION_KEY ??
    process.env.NEXTAUTH_SECRET ??
    process.env.WORKFLOW_API_TOKEN ??
    'local-project-secret';

  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptProjectApiKey(value: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptProjectApiKey(payload: string): string {
  const [version, ivBase64, tagBase64, ciphertextBase64] = payload.split(':');

  if (
    version !== 'v1' ||
    !ivBase64 ||
    !tagBase64 ||
    !ciphertextBase64
  ) {
    throw new Error('Invalid encrypted project API key payload');
  }

  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivBase64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextBase64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function getProjectApiKeyPreview(value: string): string {
  return value.slice(-4);
}

export function maskProjectApiKey(preview: string | null | undefined): string | null {
  if (!preview) {
    return null;
  }

  return `••••${preview}`;
}

export function buildProjectApiKeysState(project: {
  anthropicApiKeyPreview: string | null;
  openaiApiKeyPreview: string | null;
}): ProjectApiKeysState {
  return {
    anthropic: {
      configured: Boolean(project.anthropicApiKeyPreview),
      preview: project.anthropicApiKeyPreview,
      maskedValue: maskProjectApiKey(project.anthropicApiKeyPreview),
    },
    openai: {
      configured: Boolean(project.openaiApiKeyPreview),
      preview: project.openaiApiKeyPreview,
      maskedValue: maskProjectApiKey(project.openaiApiKeyPreview),
    },
  };
}

export function getProviderForAgent(agent: Agent): ProjectApiKeyProvider {
  return agent === Agent.CODEX ? 'openai' : 'anthropic';
}

export function getMissingProjectApiKeyMessage(agent: Agent): string {
  return agent === Agent.CODEX
    ? 'OpenAI API key is required in project settings before Codex workflows can run.'
    : 'Anthropic API key is required in project settings before Claude workflows can run.';
}

export async function validateProviderApiKey(
  provider: ProjectApiKeyProvider,
  apiKey: string
): Promise<ApiKeyValidationResult> {
  if (process.env.NODE_ENV === 'test') {
    return {
      valid: !apiKey.toLowerCase().includes('invalid'),
      message: apiKey.toLowerCase().includes('invalid')
        ? 'API key was rejected'
        : 'API key is valid',
    };
  }

  try {
    const response =
      provider === 'anthropic'
        ? await fetch('https://api.anthropic.com/v1/models', {
            method: 'GET',
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            signal: AbortSignal.timeout(8000),
          })
        : await fetch('https://api.openai.com/v1/models', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
            signal: AbortSignal.timeout(8000),
          });

    if (response.ok) {
      return { valid: true, message: 'API key is valid' };
    }

    if (response.status === 401 || response.status === 403) {
      return { valid: false, message: 'API key was rejected' };
    }

    return {
      valid: false,
      message: `Provider validation failed with status ${response.status}`,
    };
  } catch {
    return {
      valid: false,
      message: 'Provider validation request failed',
    };
  }
}
