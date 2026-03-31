import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY_ENV = 'AI_CREDENTIAL_ENCRYPTION_KEY';
const TEST_ENCRYPTION_KEY = 'test-ai-credential-encryption-key-32';

export interface EncryptedSecret {
  encryptedSecret: string;
  encryptionIv: string;
  encryptionAuthTag: string;
}

export interface SecretRecordShape {
  encryptedSecret: string | null;
  encryptionIv: string | null;
  encryptionAuthTag: string | null;
}

function getRawEncryptionKey(): string {
  const configuredKey = process.env[ENCRYPTION_KEY_ENV];

  if (configuredKey) {
    return configuredKey;
  }

  if (process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true') {
    return TEST_ENCRYPTION_KEY;
  }

  throw new Error(`${ENCRYPTION_KEY_ENV} is not configured`);
}

function getEncryptionKey(): Buffer {
  return createHash('sha256').update(getRawEncryptionKey()).digest();
}

export function maskSecret(secret: string): string {
  const normalized = secret.trim();
  return normalized.slice(-4).padStart(4, '*');
}

export function encryptSecret(secret: string): EncryptedSecret {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret.trim(), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedSecret: ciphertext.toString('base64'),
    encryptionIv: iv.toString('hex'),
    encryptionAuthTag: authTag.toString('hex'),
  };
}

export function decryptSecret(record: SecretRecordShape): string {
  if (!record.encryptedSecret || !record.encryptionIv || !record.encryptionAuthTag) {
    throw new Error('Credential secret is unavailable');
  }

  const key = getEncryptionKey();
  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    key,
    Buffer.from(record.encryptionIv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(record.encryptionAuthTag, 'hex'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(record.encryptedSecret, 'base64')),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}

export function shredSecretFields(): SecretRecordShape {
  return {
    encryptedSecret: null,
    encryptionIv: null,
    encryptionAuthTag: null,
  };
}
