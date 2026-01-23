import {
  extractTokenPreview,
  isValidTokenFormat,
  verifyTokenHash,
} from "./generate";
import { checkRateLimit, type RateLimitResult } from "./rate-limit";
import { findTokensByPreview, updateLastUsed } from "@/lib/db/tokens";

/**
 * Result of token validation
 */
export interface TokenValidationResult {
  /** Whether the token is valid */
  valid: boolean;
  /** User ID if valid, null otherwise */
  userId: string | null;
  /** Error message if invalid */
  error?: string;
  /** Rate limit result for headers */
  rateLimit?: RateLimitResult;
}

/**
 * Validate a personal access token and return the associated user ID.
 * Updates lastUsedAt on successful validation.
 *
 * @param token - The full token string (e.g., pat_abc123...)
 * @param ip - Client IP address for rate limiting (optional)
 * @returns Validation result with userId if valid
 */
export async function validateToken(
  token: string,
  ip?: string
): Promise<TokenValidationResult> {
  // Rate limit check if IP provided
  if (ip) {
    const rateLimitResult = checkRateLimit(ip);
    if (!rateLimitResult.allowed) {
      return {
        valid: false,
        userId: null,
        error: "Rate limit exceeded",
        rateLimit: rateLimitResult,
      };
    }
  }

  // Validate token format
  if (!isValidTokenFormat(token)) {
    return {
      valid: false,
      userId: null,
      error: "Invalid token format",
    };
  }

  // Extract preview for lookup
  const preview = extractTokenPreview(token);

  // Find candidate tokens by preview
  const candidates = await findTokensByPreview(preview);

  // Verify against each candidate
  for (const candidate of candidates) {
    if (verifyTokenHash(token, candidate.salt, candidate.hash)) {
      // Update lastUsedAt (fire-and-forget)
      updateLastUsed(candidate.id);

      return {
        valid: true,
        userId: candidate.userId,
      };
    }
  }

  return {
    valid: false,
    userId: null,
    error: "Invalid token",
  };
}

/**
 * Extract Bearer token from Authorization header.
 * @param authHeader - The Authorization header value
 * @returns The token string or null if not a Bearer token
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== "bearer") {
    return null;
  }

  const token = parts[1];
  // Only return if it looks like a PAT
  if (token?.startsWith("pat_")) {
    return token;
  }

  return null;
}
