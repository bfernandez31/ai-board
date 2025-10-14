import { NextRequest } from 'next/server';

/**
 * Workflow Authentication Helper
 *
 * Validates GitHub Actions workflow authentication using Bearer token.
 * This allows workflows to bypass NextAuth.js session-based authentication.
 *
 * Security:
 * - Token must be stored as GitHub Secret (WORKFLOW_API_TOKEN)
 * - Token must be stored as environment variable in Vercel
 * - Uses constant-time comparison to prevent timing attacks
 *
 * Usage:
 * ```typescript
 * const authResult = validateWorkflowAuth(request);
 * if (!authResult.isValid) {
 *   return NextResponse.json(
 *     { error: authResult.error },
 *     { status: 401 }
 *   );
 * }
 * ```
 */

export interface WorkflowAuthResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates workflow authentication from Authorization header
 *
 * Expected header format: "Authorization: Bearer <token>"
 *
 * @param request - Next.js request object
 * @returns Validation result with isValid flag and optional error message
 */
export function validateWorkflowAuth(request: NextRequest): WorkflowAuthResult {
  const expectedToken = process.env.WORKFLOW_API_TOKEN;

  // If WORKFLOW_API_TOKEN is not configured, reject all workflow requests
  if (!expectedToken) {
    console.error('[Workflow Auth] WORKFLOW_API_TOKEN not configured');
    return {
      isValid: false,
      error: 'Workflow authentication not configured',
    };
  }

  // Extract Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    console.warn('[Workflow Auth] Missing Authorization header');
    return {
      isValid: false,
      error: 'Missing Authorization header',
    };
  }

  // Validate Bearer token format
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    console.warn('[Workflow Auth] Invalid Authorization header format');
    return {
      isValid: false,
      error: 'Invalid Authorization header format',
    };
  }

  // Constant-time comparison to prevent timing attacks
  if (!constantTimeCompare(token, expectedToken)) {
    console.warn('[Workflow Auth] Invalid token');
    return {
      isValid: false,
      error: 'Invalid authentication token',
    };
  }

  console.log('[Workflow Auth] Valid token');
  return { isValid: true };
}

/**
 * Constant-time string comparison to prevent timing attacks
 *
 * This prevents attackers from using timing information to guess the token
 * character by character.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns True if strings are equal
 */
function constantTimeCompare(a: string, b: string): boolean {
  // If lengths differ, still compare to prevent timing leak
  // Use longer length to ensure full comparison
  const maxLength = Math.max(a.length, b.length);

  let result = a.length === b.length ? 0 : 1;

  for (let i = 0; i < maxLength; i++) {
    // Use bitwise OR to prevent short-circuit evaluation
    result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }

  return result === 0;
}
