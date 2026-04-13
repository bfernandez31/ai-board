import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/test', { headers });
}

describe('validateWorkflowAuth', () => {
  const VALID_TOKEN = 'test-workflow-token';

  beforeEach(() => {
    vi.stubEnv('WORKFLOW_API_TOKEN', VALID_TOKEN);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts a valid Bearer token', () => {
    const req = makeRequest({ Authorization: `Bearer ${VALID_TOKEN}` });
    const result = validateWorkflowAuth(req);
    expect(result).toEqual({ isValid: true });
  });

  it('rejects missing Authorization header', () => {
    const req = makeRequest();
    const result = validateWorkflowAuth(req);
    expect(result.isValid).toBe(false);
  });

  it('rejects invalid token', () => {
    const req = makeRequest({ Authorization: 'Bearer wrong-token-value' });
    const result = validateWorkflowAuth(req);
    expect(result.isValid).toBe(false);
  });

  it('rejects token with different length', () => {
    const req = makeRequest({ Authorization: 'Bearer short' });
    const result = validateWorkflowAuth(req);
    expect(result.isValid).toBe(false);
  });

  it('rejects non-Bearer scheme', () => {
    const req = makeRequest({ Authorization: `Basic ${VALID_TOKEN}` });
    const result = validateWorkflowAuth(req);
    expect(result.isValid).toBe(false);
  });

  it('rejects when WORKFLOW_API_TOKEN is not configured', () => {
    vi.stubEnv('WORKFLOW_API_TOKEN', '');
    const req = makeRequest({ Authorization: `Bearer ${VALID_TOKEN}` });
    const result = validateWorkflowAuth(req);
    expect(result.isValid).toBe(false);
  });
});
