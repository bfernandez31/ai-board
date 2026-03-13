import type { ApiKeyProvider } from '@prisma/client';

interface ValidationResult {
  valid: boolean;
  error?: string;
}

const PROVIDER_RULES: Record<
  ApiKeyProvider,
  { prefix: string; label: string; minLength: number }
> = {
  ANTHROPIC: {
    prefix: 'sk-ant-',
    label: 'Anthropic',
    minLength: 20,
  },
  OPENAI: {
    prefix: 'sk-',
    label: 'OpenAI',
    minLength: 20,
  },
};

/**
 * Validate API key format for a specific provider.
 * Does NOT call the provider API — format check only.
 */
export function validateApiKeyFormat(
  provider: ApiKeyProvider,
  key: string
): ValidationResult {
  const rules = PROVIDER_RULES[provider];

  if (!key || key.trim().length === 0) {
    return { valid: false, error: 'API key cannot be empty' };
  }

  if (key.length < rules.minLength) {
    return {
      valid: false,
      error: `${rules.label} API key must be at least ${rules.minLength} characters`,
    };
  }

  // Detect cross-provider mismatch: Anthropic key pasted into OpenAI field
  if (provider === 'OPENAI' && key.startsWith('sk-ant-')) {
    return {
      valid: false,
      error: "This looks like an Anthropic key. OpenAI keys start with 'sk-' but not 'sk-ant-'.",
    };
  }

  if (!key.startsWith(rules.prefix)) {
    return {
      valid: false,
      error: `Invalid key format. ${rules.label} keys must start with '${rules.prefix}'.`,
    };
  }

  return { valid: true };
}
