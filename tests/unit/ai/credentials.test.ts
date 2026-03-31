import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AI_CREDENTIAL_ENV_VAR_MAP,
  AiCredentialTypeSchema,
  AiProviderSchema,
  getCredentialFormatError,
  maskCredentialPreview,
} from '@/lib/ai/credentials';
import { decryptSecret, encryptSecret } from '@/lib/security/secret-box';

describe('AI credential helpers', () => {
  beforeEach(() => {
    vi.stubEnv(
      'AI_CREDENTIAL_ENCRYPTION_KEY',
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    );
  });

  it('validates Anthropic API key format', () => {
    expect(getCredentialFormatError('ANTHROPIC', 'API_KEY', 'sk-ant-api03-validtoken123')).toBeNull();
    expect(getCredentialFormatError('ANTHROPIC', 'API_KEY', 'invalid-key')).toContain('Anthropic API keys');
  });

  it('validates Anthropic OAuth token format', () => {
    expect(getCredentialFormatError('ANTHROPIC', 'OAUTH_TOKEN', 'oauth_token_value_123456789')).toBeNull();
    expect(getCredentialFormatError('ANTHROPIC', 'OAUTH_TOKEN', 'short')).toContain('OAuth tokens');
  });

  it('masks credential previews consistently', () => {
    expect(maskCredentialPreview('9876')).toBe('****9876');
  });

  it('maps credential type to workflow environment variable', () => {
    expect(AI_CREDENTIAL_ENV_VAR_MAP.API_KEY).toBe('ANTHROPIC_API_KEY');
    expect(AI_CREDENTIAL_ENV_VAR_MAP.OAUTH_TOKEN).toBe('CLAUDE_CODE_OAUTH_TOKEN');
    expect(AiProviderSchema.parse('ANTHROPIC')).toBe('ANTHROPIC');
    expect(AiCredentialTypeSchema.parse('API_KEY')).toBe('API_KEY');
  });

  it('encrypts and decrypts credentials', () => {
    const plaintext = 'sk-ant-api03-sensitive-secret-123456';
    const encrypted = encryptSecret(plaintext);

    expect(encrypted.ciphertext).not.toBe(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });
});
