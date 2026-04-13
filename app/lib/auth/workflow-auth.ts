import { NextRequest } from 'next/server';
import { isExplicitTestOverrideRequest } from '@/lib/auth/test-user-override';
import {
  getAcceptedWorkflowTokens,
  isAcceptedWorkflowToken,
} from '@/lib/auth/workflow-token';

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
  if (isExplicitTestOverrideRequest(request.headers)) {
    return true;
  }

  const authHeader = request.headers.get('Authorization');

  // Check for Bearer token format
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  // Get expected token from environment
  const expectedTokens = getAcceptedWorkflowTokens();

  if (expectedTokens.length === 0) {
    console.error(
      '[workflow-auth] WORKFLOW_API_TOKEN not configured in environment'
    );
    return false;
  }

  const token = authHeader.slice('Bearer '.length);
  return isAcceptedWorkflowToken(token, expectedTokens);
}

export interface WorkflowAuthResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate workflow authentication and return detailed result with error info.
 *
 * Use this when you need the specific error reason (e.g., to return it in an API response).
 * Use `verifyWorkflowToken` when you only need a boolean pass/fail.
 */
export function validateWorkflowAuth(request: NextRequest): WorkflowAuthResult {
  if (isExplicitTestOverrideRequest(request.headers)) {
    return { isValid: true };
  }

  const expectedTokens = getAcceptedWorkflowTokens();

  if (expectedTokens.length === 0) {
    console.error('[Workflow Auth] WORKFLOW_API_TOKEN not configured');
    return { isValid: false, error: 'Workflow authentication not configured' };
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    console.warn('[Workflow Auth] Missing Authorization header');
    return { isValid: false, error: 'Missing Authorization header' };
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    console.warn('[Workflow Auth] Invalid Authorization header format');
    return { isValid: false, error: 'Invalid Authorization header format' };
  }

  const isValid = isAcceptedWorkflowToken(token, expectedTokens);

  if (!isValid) {
    console.warn('[Workflow Auth] Invalid token');
    return { isValid: false, error: 'Invalid authentication token' };
  }

  console.log('[Workflow Auth] Valid token');
  return { isValid: true };
}
