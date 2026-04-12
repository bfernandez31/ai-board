import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';

// Set encryption key before importing modules that read env
const TEST_KEY = crypto.randomBytes(32).toString('hex');
process.env.CREDENTIAL_ENCRYPTION_KEY = TEST_KEY;

import { encryptCredential, decryptCredential } from '@/lib/ai-credentials/crypto';
import { validateFormat } from '@/lib/ai-credentials/providers/anthropic';
import { validateFormat as validateOpenAIFormat } from '@/lib/ai-credentials/providers/openai';
import { validateFormat as validateMistralFormat } from '@/lib/ai-credentials/providers/mistral';
import { validateFormat as validateGoogleFormat } from '@/lib/ai-credentials/providers/google';
import { getProviderModule } from '@/lib/ai-credentials/providers';

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
      const result = validateFormat('API_KEY', validKey);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject key without sk-ant- prefix', () => {
      const result = validateFormat('API_KEY', 'invalid-key');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid Anthropic API key format');
    });

    it('should reject key with too short random part', () => {
      const shortKey = 'sk-ant-api03-' + 'a'.repeat(10);
      const result = validateFormat('API_KEY', shortKey);
      expect(result.valid).toBe(false);
    });

    it('should accept key with underscores and hyphens', () => {
      const key = 'sk-ant-api03-' + 'aA0_-'.repeat(20);
      const result = validateFormat('API_KEY', key);
      expect(result.valid).toBe(true);
    });
  });

  describe('OAUTH_TOKEN format', () => {
    it('should accept valid OAuth token (20+ chars)', () => {
      const result = validateFormat('OAUTH_TOKEN', 'a'.repeat(20));
      expect(result.valid).toBe(true);
    });

    it('should reject empty OAuth token', () => {
      const result = validateFormat('OAUTH_TOKEN', '');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid OAuth token format');
    });

    it('should reject short OAuth token', () => {
      const result = validateFormat('OAUTH_TOKEN', 'short');
      expect(result.valid).toBe(false);
    });
  });
});

describe('ai-credentials/providers/openai - validateFormat', () => {
  describe('API_KEY format', () => {
    it('should accept valid OpenAI API key with sk- prefix', () => {
      const result = validateOpenAIFormat('API_KEY', 'sk-proj-' + 'a'.repeat(40));
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject key without sk- prefix', () => {
      const result = validateOpenAIFormat('API_KEY', 'invalid-key-' + 'a'.repeat(40));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must start with "sk-"');
    });

    it('should reject key that is too short', () => {
      const result = validateOpenAIFormat('API_KEY', 'sk-short');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too short');
    });

    it('should accept key with various sk- prefixes', () => {
      expect(validateOpenAIFormat('API_KEY', 'sk-svcacct-' + 'a'.repeat(40)).valid).toBe(true);
      expect(validateOpenAIFormat('API_KEY', 'sk-' + 'a'.repeat(40)).valid).toBe(true);
    });
  });

  describe('OAUTH_TOKEN format', () => {
    it('should accept OAUTH_TOKEN for OpenAI', () => {
      const result = validateOpenAIFormat('OAUTH_TOKEN', 'a'.repeat(40));
      expect(result.valid).toBe(true);
    });

    it('should reject empty OAUTH_TOKEN for OpenAI', () => {
      const result = validateOpenAIFormat('OAUTH_TOKEN', '');
      expect(result.valid).toBe(false);
    });
  });
});

describe('ai-credentials/providers/mistral - validateFormat', () => {
  describe('API_KEY format', () => {
    it('should accept valid Mistral API key (32+ chars, no whitespace)', () => {
      const validKey = 'a'.repeat(32);
      const result = validateMistralFormat('API_KEY', validKey);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty key', () => {
      const result = validateMistralFormat('API_KEY', '');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key is required');
    });

    it('should reject key shorter than 32 characters', () => {
      const result = validateMistralFormat('API_KEY', 'a'.repeat(31));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too short');
    });

    it('should reject key containing whitespace', () => {
      const result = validateMistralFormat('API_KEY', 'a'.repeat(16) + ' ' + 'b'.repeat(16));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('whitespace');
    });

    it('should accept key with hyphens and underscores', () => {
      const result = validateMistralFormat('API_KEY', 'abc-def_ghi-jkl_mno-pqr_stu-vwx_yz');
      expect(result.valid).toBe(true);
    });
  });

  describe('OAUTH_TOKEN rejection', () => {
    it('should reject OAUTH_TOKEN credential type for Mistral', () => {
      const result = validateMistralFormat('OAUTH_TOKEN', 'a'.repeat(50));
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Mistral only supports API_KEY credentials');
    });
  });
});

describe('ai-credentials/providers/google - validateFormat', () => {
  describe('API_KEY format', () => {
    it('should accept valid Google API key format (AIza...)', () => {
      const validKey = 'AIza' + 'a'.repeat(35);
      const result = validateGoogleFormat('API_KEY', validKey);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty API key', () => {
      const result = validateGoogleFormat('API_KEY', '');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('API key is required');
    });

    it('should reject API key that is too short', () => {
      const result = validateGoogleFormat('API_KEY', 'AIza' + 'a'.repeat(10));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too short');
    });

    it('should reject API key without AIza prefix', () => {
      const result = validateGoogleFormat('API_KEY', 'invalid-' + 'a'.repeat(35));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must start with AIza');
    });

    it('should reject API key containing whitespace', () => {
      const result = validateGoogleFormat('API_KEY', 'AIza' + 'a'.repeat(18) + ' ' + 'b'.repeat(17));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('whitespace');
    });
  });

  describe('OAUTH_TOKEN format', () => {
    it('should accept valid Google OAuth token (20+ chars)', () => {
      const result = validateGoogleFormat('OAUTH_TOKEN', 'ya29.' + 'a'.repeat(50));
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty OAuth token', () => {
      const result = validateGoogleFormat('OAUTH_TOKEN', '');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('OAuth token is required');
    });

    it('should reject OAuth token that is too short', () => {
      const result = validateGoogleFormat('OAUTH_TOKEN', 'short-token');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too short');
    });

    it('should reject OAuth token containing whitespace', () => {
      const result = validateGoogleFormat('OAUTH_TOKEN', 'ya29.' + 'a'.repeat(20) + ' ' + 'b'.repeat(20));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('whitespace');
    });
  });
});

describe('ai-credentials/providers - registry', () => {
  it('should return the correct module for ANTHROPIC', () => {
    const mod = getProviderModule('ANTHROPIC');
    expect(mod.validateFormat).toBeDefined();
    expect(mod.verifyWithProvider).toBeDefined();
    // Anthropic module should accept sk-ant-api format
    expect(mod.validateFormat('API_KEY', 'sk-ant-api03-' + 'a'.repeat(80)).valid).toBe(true);
  });

  it('should return the correct module for OPENAI', () => {
    const mod = getProviderModule('OPENAI');
    expect(mod.validateFormat).toBeDefined();
    expect(mod.verifyWithProvider).toBeDefined();
    // OpenAI module should accept sk- format
    expect(mod.validateFormat('API_KEY', 'sk-proj-' + 'a'.repeat(40)).valid).toBe(true);
  });

  it('should return the correct module for MISTRAL', () => {
    const mod = getProviderModule('MISTRAL');
    expect(mod.validateFormat).toBeDefined();
    expect(mod.verifyWithProvider).toBeDefined();
    // Mistral module should accept 32+ char key
    expect(mod.validateFormat('API_KEY', 'a'.repeat(32)).valid).toBe(true);
  });

  it('should return the correct module for GOOGLE', () => {
    const mod = getProviderModule('GOOGLE');
    expect(mod.validateFormat).toBeDefined();
    expect(mod.verifyWithProvider).toBeDefined();
    // Google module should accept AIza... format
    expect(mod.validateFormat('API_KEY', 'AIza' + 'a'.repeat(35)).valid).toBe(true);
    // Google module should accept OAuth tokens
    expect(mod.validateFormat('OAUTH_TOKEN', 'ya29.' + 'a'.repeat(50)).valid).toBe(true);
  });
});
