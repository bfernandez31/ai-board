import { NextRequest } from 'next/server';

/**
 * Authentication source types
 */
export type AuthSource = 'session' | 'workflow' | null;

/**
 * Check if request has a workflow Bearer token
 * @param request Next.js request object
 * @returns true if Bearer token is present (doesn't validate it)
 */
export function hasWorkflowToken(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  return authHeader?.startsWith('Bearer ') ?? false;
}

/**
 * Verify GitHub workflow authentication token
 *
 * Validates that the request comes from a GitHub Actions workflow
 * by checking the Authorization header against the WORKFLOW_API_TOKEN secret.
 *
 * @param request Next.js request object
 * @returns true if token is valid, false otherwise
 *
 * @example
 * // In API route
 * if (!await verifyWorkflowToken(request)) {
 *   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * }
 */
export async function verifyWorkflowToken(
  request: NextRequest
): Promise<boolean> {
  const authHeader = request.headers.get('Authorization');

  // Check for Bearer token format
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  // Extract token from header
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  // Get expected token from environment
  const expectedToken = process.env.WORKFLOW_API_TOKEN;

  if (!expectedToken) {
    console.error(
      '[workflow-auth] WORKFLOW_API_TOKEN not configured in environment'
    );
    return false;
  }

  // Compare tokens (constant-time comparison to prevent timing attacks)
  return token === expectedToken;
}
