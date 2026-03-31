import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decryptSecret,
  encryptSecret,
  maskSecret,
  shredSecretFields,
} from '@/lib/ai-credentials/crypto';

describe('ai credential crypto', () => {
  beforeEach(() => {
    vi.stubEnv('AI_CREDENTIAL_ENCRYPTION_KEY', 'unit-test-ai-credential-encryption-key');
  });

  it('encrypts and decrypts a secret', () => {
    const encrypted = encryptSecret('sk-ant-valid-secret-123456');

    expect(encrypted.encryptedSecret).not.toBe('sk-ant-valid-secret-123456');
    expect(decryptSecret(encrypted)).toBe('sk-ant-valid-secret-123456');
  });

  it('throws when decrypting with a different key', () => {
    const encrypted = encryptSecret('sk-ant-valid-secret-123456');
    vi.stubEnv('AI_CREDENTIAL_ENCRYPTION_KEY', 'different-key');

    expect(() => decryptSecret(encrypted)).toThrow();
  });

  it('masks secrets to the final four characters', () => {
    expect(maskSecret('sk-ant-valid-secret-123456')).toBe('3456');
  });

  it('returns null fields when shredding secrets', () => {
    expect(shredSecretFields()).toEqual({
      encryptedSecret: null,
      encryptionIv: null,
      encryptionAuthTag: null,
    });
  });
});
