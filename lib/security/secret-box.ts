import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  authTag: string;
}

function decodeEncryptionKey(rawKey: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex');
  }

  const base64Key = Buffer.from(rawKey, 'base64');
  if (base64Key.length === 32) {
    return base64Key;
  }

  const utf8Key = Buffer.from(rawKey, 'utf8');
  if (utf8Key.length === 32) {
    return utf8Key;
  }

  throw new Error(
    'AI_CREDENTIAL_ENCRYPTION_KEY must decode to exactly 32 bytes for AES-256-GCM'
  );
}

function getEncryptionKey(): Buffer {
  const rawKey = process.env.AI_CREDENTIAL_ENCRYPTION_KEY;

  if (!rawKey) {
    if (process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true') {
      return Buffer.from(
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        'hex'
      );
    }

    throw new Error('AI_CREDENTIAL_ENCRYPTION_KEY is required');
  }

  return decodeEncryptionKey(rawKey);
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

export function decryptSecret(secret: EncryptedSecret): string {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(secret.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(secret.authTag, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
