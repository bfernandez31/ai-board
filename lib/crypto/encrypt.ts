import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

export interface EncryptedData {
  /** Hex-encoded ciphertext */
  encryptedKey: string;
  /** Hex-encoded initialization vector */
  iv: string;
  /** Hex-encoded authentication tag */
  authTag: string;
}

function getEncryptionKey(): Buffer {
  const envKey = process.env.API_KEY_ENCRYPTION_KEY;
  if (!envKey) {
    throw new Error(
      "API_KEY_ENCRYPTION_KEY environment variable is required for BYOK encryption"
    );
  }
  // Derive a consistent 32-byte key from the env var
  return crypto.createHash("sha256").update(envKey).digest().subarray(0, KEY_BYTES);
}

/**
 * Encrypt a plaintext API key using AES-256-GCM.
 * Returns hex-encoded ciphertext, IV, and auth tag.
 */
export function encryptApiKey(plaintext: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_BYTES);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  return {
    encryptedKey: encrypted,
    iv: iv.toString("hex"),
    authTag: cipher.getAuthTag().toString("hex"),
  };
}

/**
 * Decrypt an encrypted API key using AES-256-GCM.
 * @param data - The encrypted data (ciphertext, IV, authTag)
 * @returns The plaintext API key
 */
export function decryptApiKey(data: EncryptedData): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(data.iv, "hex");
  const authTag = Buffer.from(data.authTag, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(data.encryptedKey, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
