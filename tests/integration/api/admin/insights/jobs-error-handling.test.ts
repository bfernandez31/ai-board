import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { validateWorkflowAuth, listAnalyzableClaudeSessions, countExpectedClaudeSessions } =
  vi.hoisted(() => ({
    validateWorkflowAuth: vi.fn(),
    listAnalyzableClaudeSessions: vi.fn(),
    countExpectedClaudeSessions: vi.fn(),
  }));

vi.mock('@/app/lib/auth/workflow-auth', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, validateWorkflowAuth };
});

vi.mock('@/app/lib/insights/predicate', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, listAnalyzableClaudeSessions, countExpectedClaudeSessions };
});

import { GET } from '@/app/api/admin/insights/jobs/route';

const WINDOW =
  'periodStart=2026-04-01T00:00:00Z&periodEnd=2026-06-01T00:00:00Z';

describe('AIB-881: GET /api/admin/insights/jobs error handling', () => {
  beforeEach(() => {
    validateWorkflowAuth.mockReset();
    listAnalyzableClaudeSessions.mockReset();
    countExpectedClaudeSessions.mockReset();
    validateWorkflowAuth.mockReturnValue({ isValid: true });
  });

  it('returns a structured 500 envelope when a predicate DB query throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    listAnalyzableClaudeSessions.mockRejectedValue(new Error('db down'));

    const req = new NextRequest(
      `http://localhost/api/admin/insights/jobs?${WINDOW}`,
      { headers: { Authorization: 'Bearer test-token' } }
    );
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
    // Failure is logged for context (constitution: Error Handling).
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('returns a structured 500 envelope when the expected-count query throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    listAnalyzableClaudeSessions.mockResolvedValue([]);
    countExpectedClaudeSessions.mockRejectedValue(new Error('db down'));

    const req = new NextRequest(
      `http://localhost/api/admin/insights/jobs?${WINDOW}`,
      { headers: { Authorization: 'Bearer test-token' } }
    );
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe('string');
    spy.mockRestore();
  });
});
