import crypto from 'crypto';
import type { StoredEncryptedCredential } from '@/lib/types/ai-credentials';

const IV_BYTES = 12;
const KEY_BYTES = 32;
const ALGORITHM = 'aes-256-gcm';

function decodeEncryptionKey(): Buffer {
  const rawKey = process.env.PROJECT_CREDENTIAL_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error('PROJECT_CREDENTIAL_ENCRYPTION_KEY is not configured');
  }

  const normalized = rawKey.trim();
  if (/^[a-f0-9]{64}$/i.test(normalized)) {
    return Buffer.from(normalized, 'hex');
  }

  const decoded = Buffer.from(normalized, 'base64');
  if (decoded.length === KEY_BYTES) {
    return decoded;
  }

  throw new Error('PROJECT_CREDENTIAL_ENCRYPTION_KEY must decode to 32 bytes');
}

export function maskCredentialLastFour(apiKey: string): string {
  const trimmed = apiKey.trim();
  return trimmed.slice(-4).padStart(4, '*');
}

export function encryptProjectCredential(apiKey: string): StoredEncryptedCredential {
  const key = decodeEncryptionKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(apiKey.trim(), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encryptedKey: encrypted.toString('base64'),
    encryptionIv: iv.toString('hex'),
    encryptionTag: tag.toString('hex'),
    lastFour: maskCredentialLastFour(apiKey),
  };
}

export function decryptProjectCredential(input: StoredEncryptedCredential): string {
  const key = decodeEncryptionKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(input.encryptionIv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(input.encryptionTag, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(input.encryptedKey, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
