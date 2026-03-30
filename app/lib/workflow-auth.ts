import { timingSafeEqual } from 'node:crypto';
import { NextRequest } from 'next/server';

export interface WorkflowAuthResult {
  isValid: boolean;
  error?: string;
}

export function validateWorkflowAuth(request: NextRequest): WorkflowAuthResult {
  const expectedToken = process.env.WORKFLOW_API_TOKEN;

  if (!expectedToken) {
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

  if (token.length !== expectedToken.length || !timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))) {
    console.warn('[Workflow Auth] Invalid token');
    return { isValid: false, error: 'Invalid authentication token' };
  }

  console.log('[Workflow Auth] Valid token');
  return { isValid: true };
}
