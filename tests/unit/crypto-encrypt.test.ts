/**
 * Unit Tests: API Key Encryption (BYOK)
 *
 * Tests AES-256-GCM encrypt/decrypt cycle for API keys.
 */

import { describe, it, expect, beforeAll } from "vitest";

// Set env before importing the module
beforeAll(() => {
  process.env.API_KEY_ENCRYPTION_KEY = "test-encryption-key-for-unit-tests";
});

describe("API Key Encryption", () => {
  it("should encrypt and decrypt an Anthropic API key", async () => {
    const { encryptApiKey, decryptApiKey } = await import(
      "@/lib/crypto/encrypt"
    );
    const plaintext = "sk-ant-api03-test-key-1234567890abcdef";

    const encrypted = encryptApiKey(plaintext);

    expect(encrypted.encryptedKey).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.authTag).toBeDefined();
    expect(encrypted.encryptedKey).not.toBe(plaintext);

    const decrypted = decryptApiKey(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("should encrypt and decrypt an OpenAI API key", async () => {
    const { encryptApiKey, decryptApiKey } = await import(
      "@/lib/crypto/encrypt"
    );
    const plaintext = "sk-proj-test-key-abcdefghijklmnop";

    const encrypted = encryptApiKey(plaintext);
    const decrypted = decryptApiKey(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it("should produce different ciphertexts for same plaintext (unique IV)", async () => {
    const { encryptApiKey } = await import("@/lib/crypto/encrypt");
    const plaintext = "sk-ant-api03-same-key-twice";

    const encrypted1 = encryptApiKey(plaintext);
    const encrypted2 = encryptApiKey(plaintext);

    expect(encrypted1.encryptedKey).not.toBe(encrypted2.encryptedKey);
    expect(encrypted1.iv).not.toBe(encrypted2.iv);
  });

  it("should fail decryption with tampered ciphertext", async () => {
    const { encryptApiKey, decryptApiKey } = await import(
      "@/lib/crypto/encrypt"
    );
    const encrypted = encryptApiKey("sk-ant-api03-tamper-test");

    // Tamper with the ciphertext
    const tampered = {
      ...encrypted,
      encryptedKey: encrypted.encryptedKey.replace(/^./, "0"),
    };

    expect(() => decryptApiKey(tampered)).toThrow();
  });

  it("should fail decryption with tampered auth tag", async () => {
    const { encryptApiKey, decryptApiKey } = await import(
      "@/lib/crypto/encrypt"
    );
    const encrypted = encryptApiKey("sk-ant-api03-auth-tag-test");

    const tampered = {
      ...encrypted,
      authTag: "0".repeat(32),
    };

    expect(() => decryptApiKey(tampered)).toThrow();
  });
});
