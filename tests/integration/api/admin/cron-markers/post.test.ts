import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

const { verifyWorkflowToken } = vi.hoisted(() => ({
  verifyWorkflowToken: vi.fn(),
}));

vi.mock('@/app/lib/auth/workflow-auth', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, verifyWorkflowToken };
});

import { POST } from '@/app/api/admin/cron-markers/route';

function makeRequest(body: unknown, authHeader?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  return new NextRequest('http://localhost/api/admin/cron-markers', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  });
}

describe('POST /api/admin/cron-markers (US1 T025)', () => {
  const prisma = getPrismaClient();

  beforeEach(async () => {
    verifyWorkflowToken.mockReset();
    await prisma.cronRunLog.deleteMany({});
  });

  it('returns 401 when no Bearer token is provided', async () => {
    verifyWorkflowToken.mockResolvedValue(false);
    const res = await POST(makeRequest({ workflowName: 'nightly-health' }));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Unauthorized');
    const rows = await prisma.cronRunLog.count();
    expect(rows).toBe(0);
  });

  it('returns 401 when Bearer token is invalid', async () => {
    verifyWorkflowToken.mockResolvedValue(false);
    const res = await POST(
      makeRequest({ workflowName: 'nightly-health' }, 'Bearer bogus-token')
    );
    expect(res.status).toBe(401);
    const rows = await prisma.cronRunLog.count();
    expect(rows).toBe(0);
  });

  it('writes a row and returns 201 with { id, ranAt } for a valid request', async () => {
    verifyWorkflowToken.mockResolvedValue(true);
    const res = await POST(
      makeRequest({ workflowName: 'nightly-health' }, 'Bearer valid-token')
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: number; ranAt: string };
    expect(typeof body.id).toBe('number');
    expect(body.id).toBeGreaterThan(0);
    expect(new Date(body.ranAt).getTime()).not.toBeNaN();

    const row = await prisma.cronRunLog.findUnique({ where: { id: body.id } });
    expect(row).not.toBeNull();
    expect(row?.workflowName).toBe('nightly-health');
  });

  it('rejects workflowName outside the CRITICAL_CRONS allowlist with 400 VALIDATION_FAILED', async () => {
    verifyWorkflowToken.mockResolvedValue(true);
    const res = await POST(
      makeRequest({ workflowName: 'random-unknown-cron' }, 'Bearer valid-token')
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: string;
      code: string;
      details: unknown[];
    };
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(Array.isArray(body.details)).toBe(true);
    expect(body.details.length).toBeGreaterThan(0);
    const rows = await prisma.cronRunLog.count();
    expect(rows).toBe(0);
  });

  it('appends a new row on every successful write (append-only contract)', async () => {
    verifyWorkflowToken.mockResolvedValue(true);

    const res1 = await POST(
      makeRequest({ workflowName: 'nightly-health' }, 'Bearer valid-token')
    );
    expect(res1.status).toBe(201);
    const first = (await res1.json()) as { id: number };

    const res2 = await POST(
      makeRequest({ workflowName: 'nightly-health' }, 'Bearer valid-token')
    );
    expect(res2.status).toBe(201);
    const second = (await res2.json()) as { id: number };

    expect(second.id).not.toBe(first.id);

    const rows = await prisma.cronRunLog.findMany({
      where: { workflowName: 'nightly-health' },
    });
    expect(rows).toHaveLength(2);
  });

  it('accepts optional durationMs and runUrl fields when valid', async () => {
    verifyWorkflowToken.mockResolvedValue(true);
    const res = await POST(
      makeRequest(
        {
          workflowName: 'nightly-log-prune',
          durationMs: 12_345,
          runUrl: 'https://github.com/bfernandez31/ai-board/actions/runs/123',
        },
        'Bearer valid-token'
      )
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: number };

    const row = await prisma.cronRunLog.findUnique({ where: { id: body.id } });
    expect(row?.durationMs).toBe(12_345);
    expect(row?.runUrl).toBe(
      'https://github.com/bfernandez31/ai-board/actions/runs/123'
    );
  });
});
