import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';

const ADMIN_EMAIL = 'admin@test.local';
const NON_ADMIN_EMAIL = 'user@test.local';

vi.mock('@/lib/db/users', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    insightsRun: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    ticket: { findMany: vi.fn() },
  },
}));

import { requireAuth } from '@/lib/db/users';
import { prisma } from '@/lib/db/client';
import { GET as getLatest } from '@/app/api/admin/insights/latest/route';
import { GET as getRuns, POST as postRuns } from '@/app/api/admin/insights/runs/route';
import { GET as getRun } from '@/app/api/admin/insights/runs/[runId]/route';

const mockRequireAuth = vi.mocked(requireAuth);
const mockFindUnique = vi.mocked(prisma.user.findUnique);

function makeRequest(url: string, method = 'GET', body?: Record<string, unknown>) {
  const options: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) options.body = JSON.stringify(body);
  return new NextRequest(`http://localhost${url}`, options);
}

describe('Admin Insights Access Control', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    vi.resetAllMocks();
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  describe('admin user gets 200 on admin endpoints', () => {
    beforeEach(() => {
      process.env.ADMIN_EMAILS = ADMIN_EMAIL;
      mockRequireAuth.mockResolvedValue('admin-user-id');
      mockFindUnique.mockResolvedValue({ email: ADMIN_EMAIL } as never);
    });

    it('GET /api/admin/insights/latest returns 200', async () => {
      vi.mocked(prisma.insightsRun.findFirst).mockResolvedValue(null);
      const res = await getLatest(makeRequest('/api/admin/insights/latest'));
      expect(res.status).toBe(200);
    });

    it('GET /api/admin/insights/runs returns 200', async () => {
      vi.mocked(prisma.insightsRun.findMany).mockResolvedValue([]);
      const res = await getRuns(makeRequest('/api/admin/insights/runs'));
      expect(res.status).toBe(200);
    });
  });

  describe('non-admin user gets 404 on all endpoints', () => {
    beforeEach(() => {
      process.env.ADMIN_EMAILS = ADMIN_EMAIL;
      mockRequireAuth.mockResolvedValue('non-admin-user-id');
      mockFindUnique.mockResolvedValue({ email: NON_ADMIN_EMAIL } as never);
    });

    it('GET /api/admin/insights/latest returns 404', async () => {
      const res = await getLatest(makeRequest('/api/admin/insights/latest'));
      expect(res.status).toBe(404);
    });

    it('GET /api/admin/insights/runs returns 404', async () => {
      const res = await getRuns(makeRequest('/api/admin/insights/runs'));
      expect(res.status).toBe(404);
    });

    it('POST /api/admin/insights/runs returns 404', async () => {
      const res = await postRuns(makeRequest('/api/admin/insights/runs', 'POST'));
      expect(res.status).toBe(404);
    });

    it('GET /api/admin/insights/runs/:id returns 404', async () => {
      const res = await getRun(
        makeRequest('/api/admin/insights/runs/1'),
        { params: Promise.resolve({ runId: '1' }) }
      );
      expect(res.status).toBe(404);
    });
  });

  describe('unauthenticated user gets 404 on all endpoints', () => {
    beforeEach(() => {
      process.env.ADMIN_EMAILS = ADMIN_EMAIL;
      mockRequireAuth.mockRejectedValue(new Error('Unauthorized'));
    });

    it('GET /api/admin/insights/latest returns 404', async () => {
      const res = await getLatest(makeRequest('/api/admin/insights/latest'));
      expect(res.status).toBe(404);
    });

    it('GET /api/admin/insights/runs returns 404', async () => {
      const res = await getRuns(makeRequest('/api/admin/insights/runs'));
      expect(res.status).toBe(404);
    });

    it('POST /api/admin/insights/runs returns 404', async () => {
      const res = await postRuns(makeRequest('/api/admin/insights/runs', 'POST'));
      expect(res.status).toBe(404);
    });
  });
});
