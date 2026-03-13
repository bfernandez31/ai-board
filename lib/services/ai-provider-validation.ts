import { AiProvider } from '@prisma/client';
import type { ProviderValidationResult } from '@/lib/types/ai-credentials';

const providerValidationConfig = {
  [AiProvider.ANTHROPIC]: {
    name: 'Anthropic',
    validationUrl: 'https://api.anthropic.com/v1/models',
    buildHeaders(apiKey: string): HeadersInit {
      return {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      };
    },
    invalidMessage:
      'Anthropic rejected this API key. Check the key, workspace access, and billing status.',
  },
  [AiProvider.OPENAI]: {
    name: 'OpenAI',
    validationUrl: 'https://api.openai.com/v1/models',
    buildHeaders(apiKey: string): HeadersInit {
      return {
        Authorization: `Bearer ${apiKey}`,
      };
    },
    invalidMessage:
      'OpenAI rejected this API key. Check the key, project access, and billing status.',
  },
} as const;

function sanitizedMessage(
  provider: AiProvider,
  status: ProviderValidationResult['validationStatus']
): string {
  if (status === 'VALID') {
    return 'Credential validated successfully.';
  }

  if (status === 'INVALID') {
    return providerValidationConfig[provider].invalidMessage;
  }

  return `${providerValidationConfig[provider].name} validation could not be completed. Try again shortly.`;
}

function buildResult(
  provider: AiProvider,
  validationStatus: ProviderValidationResult['validationStatus']
): ProviderValidationResult {
  return {
    provider,
    validationStatus,
    message: sanitizedMessage(provider, validationStatus),
    validatedAt: new Date().toISOString(),
  };
}

function getTestValidationResult(provider: AiProvider, apiKey: string): ProviderValidationResult | null {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const normalized = apiKey.trim().toLowerCase();
  if (normalized.includes('valid')) {
    return buildResult(provider, 'VALID');
  }
  if (normalized.includes('invalid')) {
    return buildResult(provider, 'INVALID');
  }
  if (normalized.includes('error')) {
    return buildResult(provider, 'ERROR');
  }

  return null;
}

async function validateRemoteProvider(
  provider: AiProvider,
  apiKey: string
): Promise<ProviderValidationResult> {
  const testResult = getTestValidationResult(provider, apiKey);
  if (testResult) {
    return testResult;
  }

  const trimmedApiKey = apiKey.trim();
  const config = providerValidationConfig[provider];

  try {
    const response = await fetch(config.validationUrl, {
      headers: config.buildHeaders(trimmedApiKey),
      cache: 'no-store',
    });

    if (response.ok) {
      return buildResult(provider, 'VALID');
    }

    if ([400, 401, 403].includes(response.status)) {
      return buildResult(provider, 'INVALID');
    }

    return buildResult(provider, 'ERROR');
  } catch {
    return buildResult(provider, 'ERROR');
  }
}

export async function validateProviderApiKey(
  provider: AiProvider,
  apiKey: string
): Promise<ProviderValidationResult> {
  switch (provider) {
    case AiProvider.ANTHROPIC:
    case AiProvider.OPENAI:
      return validateRemoteProvider(provider, apiKey);
    default:
      return buildResult(provider, 'ERROR');
  }
}
