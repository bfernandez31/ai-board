/**
 * Simple in-memory rate limiter for token validation endpoints.
 * Limits requests per IP address to prevent brute-force attacks.
 *
 * Note: In serverless environments (Vercel), this provides per-instance
 * protection only. For production, consider using Redis (Upstash/Vercel KV).
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// Per-instance rate limit storage
const rateLimitStore = new Map<string, RateLimitRecord>();

// Default limits
const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const DEFAULT_MAX_REQUESTS = 60; // 60 requests per minute

export interface RateLimitConfig {
  /** Maximum requests allowed in window */
  maxRequests?: number;
  /** Window duration in milliseconds */
  windowMs?: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Current request count in window */
  count: number;
  /** Maximum requests allowed */
  limit: number;
  /** Remaining requests in current window */
  remaining: number;
  /** Unix timestamp when the window resets */
  resetAt: number;
  /** Seconds until window resets */
  retryAfter: number;
}

/**
 * Check rate limit for an identifier (typically IP address).
 * Returns whether the request is allowed and rate limit metadata.
 */
export function checkRateLimit(
  identifier: string,
  config?: RateLimitConfig
): RateLimitResult {
  const maxRequests = config?.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const windowMs = config?.windowMs ?? DEFAULT_WINDOW_MS;
  const now = Date.now();

  const record = rateLimitStore.get(identifier);

  // No record or window expired - create new window
  if (!record || now > record.resetAt) {
    const resetAt = now + windowMs;
    rateLimitStore.set(identifier, { count: 1, resetAt });
    return {
      allowed: true,
      count: 1,
      limit: maxRequests,
      remaining: maxRequests - 1,
      resetAt: Math.floor(resetAt / 1000),
      retryAfter: 0,
    };
  }

  // Check if limit exceeded
  if (record.count >= maxRequests) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return {
      allowed: false,
      count: record.count,
      limit: maxRequests,
      remaining: 0,
      resetAt: Math.floor(record.resetAt / 1000),
      retryAfter,
    };
  }

  // Increment count
  record.count++;
  return {
    allowed: true,
    count: record.count,
    limit: maxRequests,
    remaining: maxRequests - record.count,
    resetAt: Math.floor(record.resetAt / 1000),
    retryAfter: 0,
  };
}

/**
 * Clear rate limit for an identifier.
 * Useful for testing or admin operations.
 */
export function clearRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

/**
 * Clear all rate limits.
 * Useful for testing.
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
}

/**
 * Get rate limit headers for HTTP response.
 */
export function getRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.resetAt.toString(),
    ...(result.retryAfter > 0 && {
      "Retry-After": result.retryAfter.toString(),
    }),
  };
}
