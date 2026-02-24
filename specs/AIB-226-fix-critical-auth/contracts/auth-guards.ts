/**
 * Contract: Auth Guard Environment Gating
 *
 * Defines the expected behavior of the environment guards that protect
 * the x-test-user-id header from being honored in non-test environments.
 *
 * These are NOT runtime contracts — they document the expected function
 * signatures and behavior for implementation guidance.
 */

// =============================================================================
// Checkpoint 1: Middleware (Edge Runtime, build-time inlined)
// File: proxy.ts
// =============================================================================

/**
 * preAuthCheck should ONLY allow the x-test-user-id bypass when
 * process.env.NODE_ENV === 'test' (inlined at build time).
 *
 * Expected behavior:
 * - Production build: NODE_ENV='production' → header ignored, returns null
 * - Test build: NODE_ENV='test' → header honored, returns NextResponse.next()
 * - Unknown build: NODE_ENV=undefined → header ignored (fail-secure)
 */
type PreAuthCheckContract = {
  input: {
    request: {
      headers: {
        'x-test-user-id'?: string | null
        'authorization'?: string | null
      }
    }
  }
  output: /* NextResponse | null */ unknown
  rules: [
    'MUST return null when x-test-user-id is present but NODE_ENV !== "test"',
    'MUST return NextResponse.next() when x-test-user-id is present AND NODE_ENV === "test"',
    'MUST NOT change behavior for Bearer PAT tokens (unrelated path)',
    'MUST use process.env.NODE_ENV which is build-time inlined by Next.js',
  ]
}

// =============================================================================
// Checkpoint 2: Server-side user lookup (Node.js runtime)
// File: lib/db/users.ts
// =============================================================================

/**
 * getCurrentUser should ONLY honor the x-test-user-id header when
 * process.env.NODE_ENV === 'test' (checked at runtime).
 *
 * Expected behavior:
 * - Production: NODE_ENV='production' → header ignored, falls through to NextAuth
 * - Test: NODE_ENV='test' → header honored, user looked up by ID
 * - Unknown: NODE_ENV=undefined → header ignored (fail-secure)
 */
type GetCurrentUserContract = {
  input: {
    headers: {
      'x-test-user-id'?: string | null
    }
  }
  output: {
    id: string
    email: string | null
    name: string | null
  }
  rules: [
    'MUST skip x-test-user-id lookup when NODE_ENV !== "test"',
    'MUST honor x-test-user-id lookup when NODE_ENV === "test"',
    'MUST fall through to NextAuth session when header is ignored',
    'MUST throw "Unauthorized" when no auth mechanism succeeds',
    'MUST NOT change behavior for Bearer PAT tokens (separate code path)',
  ]
}

// Type exports to satisfy TypeScript (these are documentation-only)
export type { PreAuthCheckContract, GetCurrentUserContract }
