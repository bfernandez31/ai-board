/**
 * Unit Tests: Encryption and Format Validation
 *
 * Tests for AES-256-GCM encrypt/decrypt utilities and API key format validation.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { encryptApiKey, decryptApiKey } from '@/lib/encryption/api-keys';
import { validateKeyFormat } from '@/lib/api-keys/validate';

// Set a test encryption master key (32 bytes = 64 hex chars)
const TEST_MASTER_KEY = 'a'.repeat(64);

beforeAll(() => {
  process.env.ENCRYPTION_MASTER_KEY = TEST_MASTER_KEY;
});

describe('AES-256-GCM Encryption', () => {
  it('should encrypt and decrypt a key correctly', () => {
    const plainKey = 'sk-ant-api03-test-key-12345';
    const encrypted = encryptApiKey(plainKey);
    const decrypted = decryptApiKey(encrypted);
    expect(decrypted).toBe(plainKey);
  });

  it('should produce different ciphertext for same plaintext (unique IV)', () => {
    const plainKey = 'sk-ant-api03-same-key';
    const encrypted1 = encryptApiKey(plainKey);
    const encrypted2 = encryptApiKey(plainKey);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should produce base64-encoded output', () => {
    const encrypted = encryptApiKey('sk-ant-api03-test');
    expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
    // Verify it re-encodes to same string (valid base64)
    expect(Buffer.from(encrypted, 'base64').toString('base64')).toBe(encrypted);
  });

  it('should handle empty string encryption', () => {
    const encrypted = encryptApiKey('');
    const decrypted = decryptApiKey(encrypted);
    expect(decrypted).toBe('');
  });

  it('should handle long keys', () => {
    const longKey = 'sk-ant-api03-' + 'x'.repeat(400);
    const encrypted = encryptApiKey(longKey);
    const decrypted = decryptApiKey(encrypted);
    expect(decrypted).toBe(longKey);
  });

  it('should throw on tampered ciphertext', () => {
    const encrypted = encryptApiKey('sk-ant-api03-test');
    const buf = Buffer.from(encrypted, 'base64');
    // Flip a byte in the middle (ciphertext area)
    buf[20] = buf[20] ^ 0xff;
    const tampered = buf.toString('base64');
    expect(() => decryptApiKey(tampered)).toThrow();
  });

  it('should throw when ENCRYPTION_MASTER_KEY is not set', () => {
    const original = process.env.ENCRYPTION_MASTER_KEY;
    delete process.env.ENCRYPTION_MASTER_KEY;
    expect(() => encryptApiKey('test')).toThrow('ENCRYPTION_MASTER_KEY environment variable is not set');
    process.env.ENCRYPTION_MASTER_KEY = original;
  });

  it('should throw when ENCRYPTION_MASTER_KEY has wrong length', () => {
    const original = process.env.ENCRYPTION_MASTER_KEY;
    process.env.ENCRYPTION_MASTER_KEY = 'tooshort';
    expect(() => encryptApiKey('test')).toThrow('ENCRYPTION_MASTER_KEY must be a 64-character hex string');
    process.env.ENCRYPTION_MASTER_KEY = original;
  });
});

describe('API Key Format Validation', () => {
  describe('Anthropic keys', () => {
    it('should accept valid Anthropic key prefix', () => {
      expect(validateKeyFormat('ANTHROPIC', 'sk-ant-api03-valid-key')).toBeNull();
    });

    it('should reject Anthropic key without correct prefix', () => {
      const error = validateKeyFormat('ANTHROPIC', 'sk-invalid-key');
      expect(error).toContain("sk-ant-");
    });

    it('should reject empty Anthropic key', () => {
      const error = validateKeyFormat('ANTHROPIC', '');
      expect(error).toContain('empty');
    });

    it('should trim whitespace before validation', () => {
      expect(validateKeyFormat('ANTHROPIC', '  sk-ant-api03-valid-key  ')).toBeNull();
    });
  });

  describe('OpenAI keys', () => {
    it('should accept valid OpenAI key prefix', () => {
      expect(validateKeyFormat('OPENAI', 'sk-proj-valid-key')).toBeNull();
    });

    it('should reject OpenAI key without correct prefix', () => {
      const error = validateKeyFormat('OPENAI', 'invalid-key');
      expect(error).toContain("sk-");
    });

    it('should reject empty OpenAI key', () => {
      const error = validateKeyFormat('OPENAI', '  ');
      expect(error).toContain('empty');
    });
  });
});
