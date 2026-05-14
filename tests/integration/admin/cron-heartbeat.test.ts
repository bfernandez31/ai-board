import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockPrismaUpsert = vi.fn();
vi.mock('@/lib/db/client', () => ({
  prisma: {
    cronRun: { upsert: mockPrismaUpsert },
  },
}));

import { POST } from '@/app/api/maintenance/cron-heartbeat/route';

const VALID_TOKEN = 'test-workflow-token';

function makeRequest(body: unknown, token?: string): NextRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token !== undefined) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return new NextRequest('http://localhost/api/maintenance/cron-heartbeat', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('POST /api/maintenance/cron-heartbeat', () => {
  const originalToken = process.env.WORKFLOW_API_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WORKFLOW_API_TOKEN = VALID_TOKEN;
  });

  afterEach(() => {
    process.env.WORKFLOW_API_TOKEN = originalToken;
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await POST(makeRequest({ cron: 'NIGHTLY_LOG_PRUNE' }, undefined));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });

  it('returns 401 when token is invalid', async () => {
    const res = await POST(makeRequest({ cron: 'NIGHTLY_LOG_PRUNE' }, 'wrong-token'));
    expect(res.status).toBe(401);
  });

  it('returns 400 with UNKNOWN_CRON code when cron is unknown', async () => {
    const res = await POST(makeRequest({ cron: 'NOT_A_REAL_CRON' }, VALID_TOKEN));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('UNKNOWN_CRON');
  });

  it('returns 400 when extra fields are present (strict schema)', async () => {
    const res = await POST(makeRequest({ cron: 'NIGHTLY_LOG_PRUNE', extra: 'field' }, VALID_TOKEN));
    expect(res.status).toBe(400);
  });

  it('returns 200 with cron and lastSuccessAt on valid first call', async () => {
    const now = new Date();
    mockPrismaUpsert.mockResolvedValue({ cron: 'NIGHTLY_LOG_PRUNE', lastSuccessAt: now });

    const res = await POST(makeRequest({ cron: 'NIGHTLY_LOG_PRUNE' }, VALID_TOKEN));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cron).toBe('NIGHTLY_LOG_PRUNE');
    expect(data.lastSuccessAt).toBeTruthy();
  });

  it('upserts row (advances lastSuccessAt on repeated calls)', async () => {
    const first = new Date(Date.now() - 1000);
    const second = new Date();
    mockPrismaUpsert
      .mockResolvedValueOnce({ cron: 'BILLING_RECONCILE', lastSuccessAt: first })
      .mockResolvedValueOnce({ cron: 'BILLING_RECONCILE', lastSuccessAt: second });

    await POST(makeRequest({ cron: 'BILLING_RECONCILE' }, VALID_TOKEN));
    const res2 = await POST(makeRequest({ cron: 'BILLING_RECONCILE' }, VALID_TOKEN));
    const data2 = await res2.json();
    expect(new Date(data2.lastSuccessAt).getTime()).toBeGreaterThanOrEqual(first.getTime());
  });
});
