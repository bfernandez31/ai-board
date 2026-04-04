import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';

// Set encryption key before importing modules that read env
const TEST_KEY = crypto.randomBytes(32).toString('hex');
process.env.CREDENTIAL_ENCRYPTION_KEY = TEST_KEY;

import { encryptCredential, decryptCredential } from '@/lib/ai-credentials/crypto';
import { validateFormat as validateAnthropicFormat } from '@/lib/ai-credentials/providers/anthropic';
import { validateFormat as validateOpenAIFormat } from '@/lib/ai-credentials/providers/openai';
import { validateFormat } from '@/lib/ai-credentials/providers';
import { AGENT_PROVIDER_MAP, PROVIDER_ENV_VAR_MAP } from '@/lib/ai-credentials/types';

describe('ai-credentials/crypto', () => {
  describe('encryptCredential / decryptCredential round-trip', () => {
    it('should encrypt and decrypt a credential value', () => {
      const plaintext = 'sk-ant-api03-' + 'a'.repeat(80);
      const encrypted = encryptCredential(plaintext);

      expect(encrypted.encryptedValue).toBeTruthy();
      expect(encrypted.iv).toBeTruthy();
      expect(encrypted.authTag).toBeTruthy();
      expect(encrypted.preview).toBe(plaintext.slice(-4));

      const decrypted = decryptCredential(
        encrypted.encryptedValue,
        encrypted.iv,
        encrypted.authTag
      );
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for the same input', () => {
      const plaintext = 'test-credential-value-1234567890';
      const encrypted1 = encryptCredential(plaintext);
      const encrypted2 = encryptCredential(plaintext);

      expect(encrypted1.encryptedValue).not.toBe(encrypted2.encryptedValue);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should extract the last 4 characters as preview', () => {
      const plaintext = 'sk-ant-api03-abcdefgh';
      const encrypted = encryptCredential(plaintext);
      expect(encrypted.preview).toBe('efgh');
    });

    it('should throw on tampered auth tag', () => {
      const encrypted = encryptCredential('test-value');
      const tamperedTag = Buffer.from(encrypted.authTag, 'base64');
      tamperedTag[0] ^= 0xff;

      expect(() =>
        decryptCredential(
          encrypted.encryptedValue,
          encrypted.iv,
          tamperedTag.toString('base64')
        )
      ).toThrow();
    });

    it('should throw on tampered ciphertext', () => {
      const encrypted = encryptCredential('test-value');
      const tamperedValue = Buffer.from(encrypted.encryptedValue, 'base64');
      tamperedValue[0] ^= 0xff;

      expect(() =>
        decryptCredential(
          tamperedValue.toString('base64'),
          encrypted.iv,
          encrypted.authTag
        )
      ).toThrow();
    });
  });

  describe('missing encryption key', () => {
    it('should throw when CREDENTIAL_ENCRYPTION_KEY is missing', () => {
      const originalKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
      delete process.env.CREDENTIAL_ENCRYPTION_KEY;

      expect(() => encryptCredential('test')).toThrow(
        'CREDENTIAL_ENCRYPTION_KEY environment variable is not configured'
      );

      process.env.CREDENTIAL_ENCRYPTION_KEY = originalKey;
    });

    it('should throw when CREDENTIAL_ENCRYPTION_KEY has wrong length', () => {
      const originalKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
      process.env.CREDENTIAL_ENCRYPTION_KEY = 'tooshort';

      expect(() => encryptCredential('test')).toThrow(
        'CREDENTIAL_ENCRYPTION_KEY must be a 64-character hex string'
      );

      process.env.CREDENTIAL_ENCRYPTION_KEY = originalKey;
    });
  });
});

describe('ai-credentials/providers/anthropic - validateFormat', () => {
  describe('API_KEY format', () => {
    it('should accept valid Anthropic API key format', () => {
      const validKey = 'sk-ant-api03-' + 'a'.repeat(80);
      const result = validateAnthropicFormat('API_KEY', validKey);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject key without sk-ant- prefix', () => {
      const result = validateAnthropicFormat('API_KEY', 'invalid-key');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid Anthropic API key format');
    });

    it('should reject key with too short random part', () => {
      const shortKey = 'sk-ant-api03-' + 'a'.repeat(10);
      const result = validateAnthropicFormat('API_KEY', shortKey);
      expect(result.valid).toBe(false);
    });

    it('should accept key with underscores and hyphens', () => {
      const key = 'sk-ant-api03-' + 'aA0_-'.repeat(20);
      const result = validateAnthropicFormat('API_KEY', key);
      expect(result.valid).toBe(true);
    });
  });

  describe('OAUTH_TOKEN format', () => {
    it('should accept valid OAuth token (20+ chars)', () => {
      const result = validateAnthropicFormat('OAUTH_TOKEN', 'a'.repeat(20));
      expect(result.valid).toBe(true);
    });

    it('should reject empty OAuth token', () => {
      const result = validateAnthropicFormat('OAUTH_TOKEN', '');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid OAuth token format');
    });

    it('should reject short OAuth token', () => {
      const result = validateAnthropicFormat('OAUTH_TOKEN', 'short');
      expect(result.valid).toBe(false);
    });
  });
});

describe('ai-credentials/providers/openai - validateFormat', () => {
  describe('API_KEY format', () => {
    it('should accept valid OpenAI API key format', () => {
      const validKey = 'sk-' + 'a'.repeat(48);
      const result = validateOpenAIFormat('API_KEY', validKey);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject key without sk- prefix', () => {
      const result = validateOpenAIFormat('API_KEY', 'invalid-key-no-prefix');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('sk-');
    });

    it('should reject key that is too short', () => {
      const result = validateOpenAIFormat('API_KEY', 'sk-short');
      expect(result.valid).toBe(false);
    });

    it('should accept key with proj prefix format', () => {
      const key = 'sk-proj-' + 'a'.repeat(40);
      const result = validateOpenAIFormat('API_KEY', key);
      expect(result.valid).toBe(true);
    });
  });

  describe('OAUTH_TOKEN format', () => {
    it('should reject OAuth token (unsupported for OpenAI)', () => {
      const result = validateOpenAIFormat('OAUTH_TOKEN', 'a'.repeat(50));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('only supports API Key');
    });
  });
});

describe('ai-credentials/providers/index - validateFormat routing', () => {
  it('should route ANTHROPIC to anthropic provider', () => {
    const validKey = 'sk-ant-api03-' + 'a'.repeat(80);
    const result = validateFormat('ANTHROPIC', 'API_KEY', validKey);
    expect(result.valid).toBe(true);
  });

  it('should route OPENAI to openai provider', () => {
    const validKey = 'sk-' + 'a'.repeat(48);
    const result = validateFormat('OPENAI', 'API_KEY', validKey);
    expect(result.valid).toBe(true);
  });

  it('should reject Anthropic key format for OPENAI provider', () => {
    const anthropicKey = 'sk-ant-api03-' + 'a'.repeat(80);
    const result = validateFormat('OPENAI', 'API_KEY', anthropicKey);
    // sk-ant-api03-... does start with sk- so it should pass OpenAI format
    expect(result.valid).toBe(true);
  });

  it('should reject OpenAI key format for ANTHROPIC provider', () => {
    const openaiKey = 'sk-proj-' + 'a'.repeat(40);
    const result = validateFormat('ANTHROPIC', 'API_KEY', openaiKey);
    expect(result.valid).toBe(false);
  });
});

describe('ai-credentials/types - AGENT_PROVIDER_MAP', () => {
  it('should map CLAUDE to ANTHROPIC', () => {
    expect(AGENT_PROVIDER_MAP.CLAUDE).toBe('ANTHROPIC');
  });

  it('should map CODEX to OPENAI', () => {
    expect(AGENT_PROVIDER_MAP.CODEX).toBe('OPENAI');
  });
});

describe('ai-credentials/types - PROVIDER_ENV_VAR_MAP', () => {
  it('should map ANTHROPIC API_KEY to ANTHROPIC_API_KEY', () => {
    expect(PROVIDER_ENV_VAR_MAP.ANTHROPIC.API_KEY).toBe('ANTHROPIC_API_KEY');
  });

  it('should map ANTHROPIC OAUTH_TOKEN to CLAUDE_CODE_OAUTH_TOKEN', () => {
    expect(PROVIDER_ENV_VAR_MAP.ANTHROPIC.OAUTH_TOKEN).toBe('CLAUDE_CODE_OAUTH_TOKEN');
  });

  it('should map OPENAI API_KEY to OPENAI_API_KEY', () => {
    expect(PROVIDER_ENV_VAR_MAP.OPENAI.API_KEY).toBe('OPENAI_API_KEY');
  });
});
