import { NextRequest } from 'next/server';
import { isExplicitTestOverrideRequest } from '@/lib/auth/test-user-override';
import {
  getAcceptedWorkflowTokens,
  isAcceptedWorkflowToken,
} from '@/lib/auth/workflow-token';

export interface WorkflowAuthResult {
  isValid: boolean;
  error?: string;
}

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

  const isValid = isAcceptedWorkflowToken(token);

  if (!isValid) {
    console.warn('[Workflow Auth] Invalid token');
    return { isValid: false, error: 'Invalid authentication token' };
  }

  console.log('[Workflow Auth] Valid token');
  return { isValid: true };
}
