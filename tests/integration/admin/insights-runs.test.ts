import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

vi.mock('@/lib/db/users', () => ({
  requireAuth: vi.fn(async () => 'test-user-id'),
}));

vi.mock('@/lib/db/client', () => {
  const actual = getPrismaClient();
  return { prisma: actual };
});

vi.mock('@/app/lib/insights/run-analysis', () => ({
  executeInsightsAnalysis: vi.fn(async () => undefined),
}));

vi.mock('@/app/lib/blob/client', () => ({
  isConfigured: vi.fn(() => true),
  uploadInsightsReport: vi.fn(async () => ({ url: 'test' })),
  streamInsightsReport: vi.fn(async () => null),
}));

vi.mock('@/app/lib/auth/workflow-auth', () => ({
  verifyWorkflowToken: vi.fn(async () => false),
}));

import { requireAuth } from '@/lib/db/users';
import { isConfigured } from '@/app/lib/blob/client';
import { POST, GET } from '@/app/api/admin/insights/runs/route';
import { GET as getRun } from '@/app/api/admin/insights/runs/[runId]/route';
import { PATCH } from '@/app/api/admin/insights/runs/[runId]/status/route';

const prisma = getPrismaClient();

function makeRequest(url: string, method = 'GET', body?: Record<string, unknown>) {
  const options: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) options.body = JSON.stringify(body);
  return new NextRequest(`http://localhost${url}`, options);
}

describe('Admin Insights Runs API Lifecycle', () => {
  let testProjectId: number;
  let testProjectKey: string;

  beforeAll(async () => {
    const user = await prisma.user.findUnique({ where: { id: 'test-user-id' } });
    if (!user) {
      await prisma.user.create({
        data: { id: 'test-user-id', email: 'test@e2e.local', updatedAt: new Date() },
      });
    }

    const project = await prisma.project.findFirst({
      where: { name: { startsWith: '[e2e]' } },
      select: { id: true, key: true },
    });

    if (project) {
      testProjectId = project.id;
      testProjectKey = project.key;
    } else {
      const p = await prisma.project.create({
        data: {
          name: '[e2e] Insights Test',
          key: 'EIT',
          userId: 'test-user-id',
          githubOwner: 'test',
          githubRepo: 'test',
          updatedAt: new Date(),
        },
      });
      testProjectId = p.id;
      testProjectKey = p.key;
    }
  });

  beforeEach(async () => {
    vi.resetAllMocks();
    process.env.ADMIN_EMAILS = 'test@e2e.local';
    vi.mocked(requireAuth).mockResolvedValue('test-user-id');
    vi.mocked(isConfigured).mockReturnValue(true);

    await prisma.insightsRun.deleteMany({});
    await prisma.ticket.deleteMany({
      where: { projectId: testProjectId, title: { startsWith: '[e2e] Insights' } },
    });
  });

  afterAll(async () => {
    await prisma.insightsRun.deleteMany({});
    await prisma.ticket.deleteMany({
      where: { projectId: testProjectId, title: { startsWith: '[e2e] Insights' } },
    });
  });

  describe('POST /api/admin/insights/runs', () => {
    it('creates a run and returns 201', async () => {
      await prisma.ticket.create({
        data: {
          title: '[e2e] Insights test ticket',
          description: '[e2e] Test description',
          ticketKey: `${testProjectKey}-991`,
          ticketNumber: 991,
          projectId: testProjectId,
          stage: 'SHIP',
          agent: 'CLAUDE',
        },
      });

      const res = await POST(makeRequest('/api/admin/insights/runs', 'POST'));
      expect(res.status).toBe(201);

      const data = await res.json();
      expect(data.run.status).toBe('PENDING');
    });

    it('returns 409 with RUN_IN_PROGRESS when run is active', async () => {
      await prisma.insightsRun.create({
        data: {
          triggeredBy: 'test-user-id',
          status: 'RUNNING',
          timeoutAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });

      const res = await POST(makeRequest('/api/admin/insights/runs', 'POST'));
      expect(res.status).toBe(409);

      const data = await res.json();
      expect(data.code).toBe('RUN_IN_PROGRESS');
    });

    it('returns 409 with NO_NEW_TICKETS when no tickets shipped', async () => {
      const res = await POST(makeRequest('/api/admin/insights/runs', 'POST'));
      expect(res.status).toBe(409);

      const data = await res.json();
      expect(data.code).toBe('NO_NEW_TICKETS');
    });

    it('returns 503 when blob not configured', async () => {
      vi.mocked(isConfigured).mockReturnValue(false);

      const res = await POST(makeRequest('/api/admin/insights/runs', 'POST'));
      expect(res.status).toBe(503);

      const data = await res.json();
      expect(data.code).toBe('BLOB_NOT_CONFIGURED');
    });
  });

  describe('GET /api/admin/insights/runs', () => {
    it('returns empty list', async () => {
      const res = await GET(makeRequest('/api/admin/insights/runs'));
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.runs).toEqual([]);
      expect(data.hasMore).toBe(false);
    });

    it('returns runs list', async () => {
      await prisma.insightsRun.create({
        data: {
          triggeredBy: 'test-user-id',
          status: 'COMPLETED',
          timeoutAt: new Date(),
          completedAt: new Date(),
        },
      });

      const res = await GET(makeRequest('/api/admin/insights/runs'));
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.runs).toHaveLength(1);
    });
  });

  describe('GET /api/admin/insights/runs/:id', () => {
    it('returns run details', async () => {
      const run = await prisma.insightsRun.create({
        data: {
          triggeredBy: 'test-user-id',
          timeoutAt: new Date(),
        },
      });

      const res = await getRun(
        makeRequest(`/api/admin/insights/runs/${run.id}`),
        { params: Promise.resolve({ runId: String(run.id) }) }
      );
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.run.id).toBe(run.id);
    });

    it('returns 404 for non-existent run', async () => {
      const res = await getRun(
        makeRequest('/api/admin/insights/runs/99999'),
        { params: Promise.resolve({ runId: '99999' }) }
      );
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/admin/insights/runs/:id/status', () => {
    it('transitions PENDING to RUNNING', async () => {
      const run = await prisma.insightsRun.create({
        data: {
          triggeredBy: 'test-user-id',
          timeoutAt: new Date(),
          status: 'PENDING',
        },
      });

      const res = await PATCH(
        makeRequest(`/api/admin/insights/runs/${run.id}/status`, 'PATCH', {
          status: 'RUNNING',
        }),
        { params: Promise.resolve({ runId: String(run.id) }) }
      );
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.run.status).toBe('RUNNING');
      expect(data.run.startedAt).toBeTruthy();
    });

    it('transitions RUNNING to COMPLETED with required fields', async () => {
      const run = await prisma.insightsRun.create({
        data: {
          triggeredBy: 'test-user-id',
          timeoutAt: new Date(),
          status: 'RUNNING',
          startedAt: new Date(),
        },
      });

      const res = await PATCH(
        makeRequest(`/api/admin/insights/runs/${run.id}/status`, 'PATCH', {
          status: 'COMPLETED',
          periodStart: '2026-04-01T00:00:00.000Z',
          periodEnd: '2026-05-01T00:00:00.000Z',
          sessionCount: 42,
          ticketCount: 15,
          reportKey: 'insights-reports/1.html',
          reportSize: 5000,
        }),
        { params: Promise.resolve({ runId: String(run.id) }) }
      );
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.run.status).toBe('COMPLETED');
      expect(data.run.sessionCount).toBe(42);
    });

    it('transitions RUNNING to FAILED with errorMessage', async () => {
      const run = await prisma.insightsRun.create({
        data: {
          triggeredBy: 'test-user-id',
          timeoutAt: new Date(),
          status: 'RUNNING',
          startedAt: new Date(),
        },
      });

      const res = await PATCH(
        makeRequest(`/api/admin/insights/runs/${run.id}/status`, 'PATCH', {
          status: 'FAILED',
          errorMessage: 'Test failure',
        }),
        { params: Promise.resolve({ runId: String(run.id) }) }
      );
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.run.status).toBe('FAILED');
      expect(data.run.errorMessage).toBe('Test failure');
    });

    it('returns 400 for invalid transition', async () => {
      const run = await prisma.insightsRun.create({
        data: {
          triggeredBy: 'test-user-id',
          timeoutAt: new Date(),
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      const res = await PATCH(
        makeRequest(`/api/admin/insights/runs/${run.id}/status`, 'PATCH', {
          status: 'RUNNING',
        }),
        { params: Promise.resolve({ runId: String(run.id) }) }
      );
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.code).toBe('INVALID_TRANSITION');
    });
  });
});
