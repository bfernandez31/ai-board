import crypto from 'crypto';
import { promisify } from 'util';

const TOKEN_PREFIX = 'pat_';
const SCRYPT_KEYLEN = 64;
const SALT_LENGTH = 16;

const scryptAsync = promisify(crypto.scrypt);

/**
 * Generate a new personal access token
 * Format: pat_ + 32 hex characters (128-bit entropy)
 */
export function generateToken(): string {
  const randomPart = crypto.randomBytes(16).toString('hex');
  return `${TOKEN_PREFIX}${randomPart}`;
}

/**
 * Create SHA-256 hash for fast database lookup
 */
export function getTokenLookup(plainToken: string): string {
  return crypto.createHash('sha256').update(plainToken).digest('hex');
}

/**
 * Extract last 4 characters for user identification
 */
export function getTokenPreview(plainToken: string): string {
  return plainToken.slice(-4);
}

/**
 * Hash token with scrypt for secure storage
 * Returns format: salt:hash (both hex-encoded)
 */
export async function hashToken(plainToken: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const hash = await scryptAsync(plainToken, salt, SCRYPT_KEYLEN) as Buffer;
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

/**
 * Verify plain token against scrypt hash
 */
export async function verifyToken(plainToken: string, storedHash: string): Promise<boolean> {
  const [saltHex, hashHex] = storedHash.split(':');
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, 'hex');
  const hash = await scryptAsync(plainToken, salt, SCRYPT_KEYLEN) as Buffer;
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, 'hex'));
}

/**
 * Validate token format: pat_ prefix + 32 hex characters
 */
export function isValidTokenFormat(token: string): boolean {
  return /^pat_[a-f0-9]{32}$/.test(token);
}
