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

const PROVIDER_VALIDATION_SUCCESS_MESSAGE = 'API key is valid';
const PROVIDER_VALIDATION_REJECTED_MESSAGE = 'API key was rejected';
const PROVIDER_VALIDATION_REQUEST_FAILED_MESSAGE = 'Provider validation request failed';

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
  switch (agent) {
    case Agent.CODEX:
      return 'openai';
    default:
      return 'anthropic';
  }
}

export function getMissingProjectApiKeyMessage(agent: Agent): string {
  switch (agent) {
    case Agent.CODEX:
      return 'OpenAI API key is required in project settings before Codex workflows can run.';
    default:
      return 'Anthropic API key is required in project settings before Claude workflows can run.';
  }
}

function buildProviderValidationRequest(
  provider: ProjectApiKeyProvider,
  apiKey: string
): RequestInit & { url: string } {
  switch (provider) {
    case 'anthropic':
      return {
        url: 'https://api.anthropic.com/v1/models',
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        signal: AbortSignal.timeout(8000),
      };
    case 'openai':
      return {
        url: 'https://api.openai.com/v1/models',
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(8000),
      };
  }
}

export async function validateProviderApiKey(
  provider: ProjectApiKeyProvider,
  apiKey: string
): Promise<ApiKeyValidationResult> {
  if (process.env.NODE_ENV === 'test') {
    const isRejected = apiKey.toLowerCase().includes('invalid');

    return {
      valid: !isRejected,
      message: isRejected
        ? PROVIDER_VALIDATION_REJECTED_MESSAGE
        : PROVIDER_VALIDATION_SUCCESS_MESSAGE,
    };
  }

  try {
    const { url, ...requestInit } = buildProviderValidationRequest(provider, apiKey);
    const response = await fetch(url, requestInit);

    if (response.ok) {
      return { valid: true, message: PROVIDER_VALIDATION_SUCCESS_MESSAGE };
    }

    if (response.status === 401 || response.status === 403) {
      return { valid: false, message: PROVIDER_VALIDATION_REJECTED_MESSAGE };
    }

    return {
      valid: false,
      message: `Provider validation failed with status ${response.status}`,
    };
  } catch {
    return {
      valid: false,
      message: PROVIDER_VALIDATION_REQUEST_FAILED_MESSAGE,
    };
  }
}
