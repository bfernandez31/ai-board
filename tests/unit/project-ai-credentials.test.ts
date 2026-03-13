import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decryptProjectCredential, encryptProjectCredential, maskCredentialLastFour } from '@/lib/security/project-ai-credentials';

describe('project-ai-credentials', () => {
  beforeEach(() => {
    process.env.PROJECT_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  });

  it('encrypts and decrypts API keys', () => {
    const encrypted = encryptProjectCredential('sk-test-valid-1234');

    expect(encrypted.encryptedKey).not.toContain('sk-test-valid-1234');
    expect(decryptProjectCredential(encrypted)).toBe('sk-test-valid-1234');
  });

  it('stores only the masked suffix metadata', () => {
    expect(maskCredentialLastFour('abcd1234')).toBe('1234');
    expect(maskCredentialLastFour('xyz')).toBe('*xyz');
  });

  it('throws when the master key is not configured', () => {
    vi.stubEnv('PROJECT_CREDENTIAL_ENCRYPTION_KEY', '');

    expect(() => encryptProjectCredential('sk-test-valid-1234')).toThrow(
      'PROJECT_CREDENTIAL_ENCRYPTION_KEY is not configured'
    );
  });
});
