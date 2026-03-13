import { AiProvider } from '@prisma/client';
import type { ProviderValidationResult } from '@/lib/types/ai-credentials';

function sanitizedMessage(provider: AiProvider, status: ProviderValidationResult['validationStatus']): string {
  if (status === 'VALID') {
    return 'Credential validated successfully.';
  }

  if (status === 'INVALID') {
    return provider === AiProvider.ANTHROPIC
      ? 'Anthropic rejected this API key. Check the key, workspace access, and billing status.'
      : 'OpenAI rejected this API key. Check the key, project access, and billing status.';
  }

  return provider === AiProvider.ANTHROPIC
    ? 'Anthropic validation could not be completed. Try again shortly.'
    : 'OpenAI validation could not be completed. Try again shortly.';
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

async function validateAnthropic(apiKey: string): Promise<ProviderValidationResult> {
  const testResult = getTestValidationResult(AiProvider.ANTHROPIC, apiKey);
  if (testResult) {
    return testResult;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey.trim(),
        'anthropic-version': '2023-06-01',
      },
      cache: 'no-store',
    });

    if (response.ok) {
      return buildResult(AiProvider.ANTHROPIC, 'VALID');
    }

    if ([400, 401, 403].includes(response.status)) {
      return buildResult(AiProvider.ANTHROPIC, 'INVALID');
    }

    return buildResult(AiProvider.ANTHROPIC, 'ERROR');
  } catch {
    return buildResult(AiProvider.ANTHROPIC, 'ERROR');
  }
}

async function validateOpenAI(apiKey: string): Promise<ProviderValidationResult> {
  const testResult = getTestValidationResult(AiProvider.OPENAI, apiKey);
  if (testResult) {
    return testResult;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      cache: 'no-store',
    });

    if (response.ok) {
      return buildResult(AiProvider.OPENAI, 'VALID');
    }

    if ([400, 401, 403].includes(response.status)) {
      return buildResult(AiProvider.OPENAI, 'INVALID');
    }

    return buildResult(AiProvider.OPENAI, 'ERROR');
  } catch {
    return buildResult(AiProvider.OPENAI, 'ERROR');
  }
}

export async function validateProviderApiKey(
  provider: AiProvider,
  apiKey: string
): Promise<ProviderValidationResult> {
  switch (provider) {
    case AiProvider.ANTHROPIC:
      return validateAnthropic(apiKey);
    case AiProvider.OPENAI:
      return validateOpenAI(apiKey);
    default:
      return buildResult(provider, 'ERROR');
  }
}
