/**
 * Unit Tests: AES-256-GCM Encryption
 *
 * Tests for the BYOK encryption library used to store API keys at rest.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt } from '@/lib/crypto/encrypt';

const TEST_ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes in hex

describe('AES-256-GCM Encryption', () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.BYOK_ENCRYPTION_KEY;
    process.env.BYOK_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.BYOK_ENCRYPTION_KEY;
    } else {
      process.env.BYOK_ENCRYPTION_KEY = originalKey;
    }
  });

  it('should encrypt and decrypt a string roundtrip', () => {
    const plaintext = 'sk-ant-api03-test-key-12345';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts for the same plaintext (random IV)', () => {
    const plaintext = 'sk-ant-api03-same-key';
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);
    expect(encrypted1.encryptedKey).not.toBe(encrypted2.encryptedKey);
    expect(encrypted1.iv).not.toBe(encrypted2.iv);
  });

  it('should return hex-encoded iv and authTag', () => {
    const encrypted = encrypt('test');
    expect(encrypted.iv).toMatch(/^[a-f0-9]+$/);
    expect(encrypted.authTag).toMatch(/^[a-f0-9]+$/);
    // IV should be 12 bytes = 24 hex chars
    expect(encrypted.iv).toHaveLength(24);
    // Auth tag should be 16 bytes = 32 hex chars
    expect(encrypted.authTag).toHaveLength(32);
  });

  it('should fail decryption with tampered ciphertext', () => {
    const encrypted = encrypt('test-key');
    const tampered = {
      ...encrypted,
      encryptedKey: encrypted.encryptedKey.replace(/./g, '0'),
    };
    expect(() => decrypt(tampered)).toThrow();
  });

  it('should fail decryption with tampered auth tag', () => {
    const encrypted = encrypt('test-key');
    const tampered = {
      ...encrypted,
      authTag: '0'.repeat(32),
    };
    expect(() => decrypt(tampered)).toThrow();
  });

  it('should throw if BYOK_ENCRYPTION_KEY is not set', () => {
    delete process.env.BYOK_ENCRYPTION_KEY;
    expect(() => encrypt('test')).toThrow('BYOK_ENCRYPTION_KEY environment variable is not set');
  });

  it('should throw if BYOK_ENCRYPTION_KEY has wrong length', () => {
    process.env.BYOK_ENCRYPTION_KEY = 'tooshort';
    expect(() => encrypt('test')).toThrow('BYOK_ENCRYPTION_KEY must be a 64-character hex string');
  });

  it('should handle empty string', () => {
    const encrypted = encrypt('');
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe('');
  });

  it('should handle long strings', () => {
    const longKey = 'sk-ant-api03-' + 'x'.repeat(1000);
    const encrypted = encrypt(longKey);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(longKey);
  });
});
