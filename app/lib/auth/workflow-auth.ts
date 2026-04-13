import { NextRequest } from 'next/server';
import { isExplicitTestOverrideRequest } from '@/lib/auth/test-user-override';
import {
  getAcceptedWorkflowTokens,
  isAcceptedWorkflowToken,
} from '@/lib/auth/workflow-token';

/**
 * Check if request has a workflow Bearer token (doesn't validate it).
 */
export function hasWorkflowToken(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  return authHeader?.startsWith('Bearer ') ?? false;
}

/**
 * Verify workflow token and return a boolean pass/fail.
 * Delegates to `validateWorkflowAuth` — use that directly when you need error details.
 */
export async function verifyWorkflowToken(
  request: NextRequest
): Promise<boolean> {
  return validateWorkflowAuth(request).isValid;
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
