import { timingSafeEqual } from 'node:crypto';
import { NextRequest } from 'next/server';
import { isExplicitTestOverrideRequest } from '@/lib/auth/test-user-override';

export interface WorkflowAuthResult {
  isValid: boolean;
  error?: string;
}

const TEST_WORKFLOW_TOKEN = 'test-workflow-token-for-e2e-tests-only';

function getAcceptedWorkflowTokens(): string[] {
  const tokens = new Set<string>();

  if (process.env.WORKFLOW_API_TOKEN) {
    tokens.add(process.env.WORKFLOW_API_TOKEN);
  }

  if (
    process.env.TEST_MODE === 'true' ||
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST_INTEGRATION === '1'
  ) {
    tokens.add(TEST_WORKFLOW_TOKEN);
  }

  return [...tokens];
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

  const isValid = expectedTokens.some((expectedToken) => (
    token.length === expectedToken.length &&
    timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))
  ));

  if (!isValid) {
    console.warn('[Workflow Auth] Invalid token');
    return { isValid: false, error: 'Invalid authentication token' };
  }

  console.log('[Workflow Auth] Valid token');
  return { isValid: true };
}
