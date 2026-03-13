import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { randomBytes } from 'crypto';

// Generate a test encryption key (32 bytes = 64 hex chars)
const TEST_ENCRYPTION_KEY = randomBytes(32).toString('hex');

describe('AES-256-GCM Encryption', () => {
  let encrypt: (plaintext: string) => string;
  let decrypt: (encrypted: string) => string;

  beforeAll(async () => {
    process.env.API_KEY_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    const mod = await import('@/lib/crypto/encryption');
    encrypt = mod.encrypt;
    decrypt = mod.decrypt;
  });

  afterAll(() => {
    delete process.env.API_KEY_ENCRYPTION_KEY;
  });

  it('should encrypt and decrypt a string (roundtrip)', () => {
    const plaintext = 'sk-ant-api03-test-key-value-12345';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce format iv:authTag:ciphertext', () => {
    const encrypted = encrypt('test-value');
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);

    // IV: 12 bytes = 24 hex chars
    expect(parts[0]).toHaveLength(24);
    // Auth tag: 16 bytes = 32 hex chars
    expect(parts[1]).toHaveLength(32);
    // Ciphertext: variable length
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it('should produce different IVs per encryption call', () => {
    const plaintext = 'sk-ant-api03-same-plaintext';
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);

    // Different IVs mean different ciphertexts
    expect(encrypted1).not.toBe(encrypted2);

    // But both decrypt to the same value
    expect(decrypt(encrypted1)).toBe(plaintext);
    expect(decrypt(encrypted2)).toBe(plaintext);
  });

  it('should detect tampered ciphertext', () => {
    const encrypted = encrypt('test-key');
    const parts = encrypted.split(':');

    // Tamper with ciphertext
    const tampered = `${parts[0]}:${parts[1]}:ff${parts[2].slice(2)}`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it('should detect tampered auth tag', () => {
    const encrypted = encrypt('test-key');
    const parts = encrypted.split(':');

    // Tamper with auth tag
    const tamperedTag = 'a'.repeat(32);
    const tampered = `${parts[0]}:${tamperedTag}:${parts[2]}`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it('should throw on invalid encrypted format', () => {
    expect(() => decrypt('invalid-data')).toThrow('Invalid encrypted data format');
    expect(() => decrypt('a:b')).toThrow('Invalid encrypted data format');
  });

  it('should handle empty string encryption', () => {
    const encrypted = encrypt('');
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe('');
  });

  it('should handle long API key strings', () => {
    const longKey = 'sk-ant-api03-' + 'a'.repeat(200);
    const encrypted = encrypt(longKey);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(longKey);
  });
});

describe('AES-256-GCM Encryption - Missing Key', () => {
  it('should throw when API_KEY_ENCRYPTION_KEY is not set', async () => {
    const originalKey = process.env.API_KEY_ENCRYPTION_KEY;
    delete process.env.API_KEY_ENCRYPTION_KEY;

    // Re-import to get fresh module with missing env var
    vi.resetModules();
    const { encrypt } = await import('@/lib/crypto/encryption');

    expect(() => encrypt('test')).toThrow('API_KEY_ENCRYPTION_KEY environment variable is not set');

    // Restore
    if (originalKey) {
      process.env.API_KEY_ENCRYPTION_KEY = originalKey;
    }
  });

  it('should throw when API_KEY_ENCRYPTION_KEY has wrong length', async () => {
    process.env.API_KEY_ENCRYPTION_KEY = 'tooshort';

    vi.resetModules();
    const { encrypt } = await import('@/lib/crypto/encryption');

    expect(() => encrypt('test')).toThrow('must be exactly 64 hex characters');

    // Restore
    process.env.API_KEY_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
  });
});
