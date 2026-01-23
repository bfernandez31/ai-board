import crypto from "crypto";

/**
 * Token format: pat_{64-hex-chars} (68 chars total)
 * - Prefix: "pat_" (Personal Access Token)
 * - Entropy: 32 bytes / 256 bits encoded as 64 hex characters
 */
const TOKEN_PREFIX = "pat_";
const TOKEN_ENTROPY_BYTES = 32;
const SALT_BYTES = 16;

export interface GeneratedToken {
  /** Full token to display once to user (e.g., pat_abc123...) */
  token: string;
  /** SHA-256 hash of salt+token (64 hex chars) */
  hash: string;
  /** Random salt used for hashing (32 hex chars) */
  salt: string;
  /** Last 4 characters of token for display in list */
  preview: string;
}

/**
 * Generate a new personal access token with cryptographically secure random bytes.
 * The full token is returned once for the user to save. Only the hash is stored.
 */
export function generatePersonalAccessToken(): GeneratedToken {
  // Generate 32 bytes of random entropy (256 bits)
  const entropy = crypto.randomBytes(TOKEN_ENTROPY_BYTES);
  const token = `${TOKEN_PREFIX}${entropy.toString("hex")}`;

  // Generate 16-byte random salt (32 hex chars)
  const salt = crypto.randomBytes(SALT_BYTES).toString("hex");

  // Hash the salt + token using SHA-256
  const hash = crypto.createHash("sha256").update(salt + token).digest("hex");

  // Extract last 4 characters for preview
  const preview = token.slice(-4);

  return {
    token,
    hash,
    salt,
    preview,
  };
}

/**
 * Verify a token against a stored hash using constant-time comparison.
 * @param token - The full token (e.g., pat_abc123...)
 * @param storedSalt - The salt stored with the token record
 * @param storedHash - The hash stored with the token record
 * @returns true if the token matches, false otherwise
 */
export function verifyTokenHash(
  token: string,
  storedSalt: string,
  storedHash: string
): boolean {
  // Compute hash of salt + provided token
  const candidateHash = crypto
    .createHash("sha256")
    .update(storedSalt + token)
    .digest("hex");

  // Use constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(candidateHash, "hex"),
      Buffer.from(storedHash, "hex")
    );
  } catch {
    // If buffers have different lengths, they don't match
    return false;
  }
}

/**
 * Extract the preview (last 4 characters) from a token.
 * Used for lookup during validation.
 */
export function extractTokenPreview(token: string): string {
  return token.slice(-4);
}

/**
 * Check if a string is a valid token format.
 * Format: pat_{64-hex-chars}
 */
export function isValidTokenFormat(token: string): boolean {
  if (!token.startsWith(TOKEN_PREFIX)) {
    return false;
  }
  const entropy = token.slice(TOKEN_PREFIX.length);
  // Must be exactly 64 hex characters
  return entropy.length === 64 && /^[a-f0-9]+$/.test(entropy);
}
