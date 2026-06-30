import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

const { requireAdminOrNotFound } = vi.hoisted(() => ({
  requireAdminOrNotFound: vi.fn(),
}));

vi.mock('@/app/lib/auth/admin', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return {
    ...actual,
    requireAdminOrNotFound,
  };
});

import { GET } from '@/app/api/admin/insights/reports/route';
import type { ReportListEntry } from '@/app/lib/insights/repository';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/admin/insights/reports');
}

describe('GET /api/admin/insights/reports (US1, AIB-791)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    requireAdminOrNotFound.mockReset();
    await prisma.insightsReport.deleteMany({});
    ctx;
  });

  it('returns reports in reverse-chronological order, capped at 200 (SC-007)', async () => {
    requireAdminOrNotFound.mockResolvedValue({ ok: true, email: 'admin@e2e.local' });

    const base = new Date('2026-01-01T00:00:00Z').getTime();
    const rows = Array.from({ length: 250 }, (_, i) => ({
      status: 'COMPLETED' as const,
      generatedAt: new Date(base + i * 60_000),
      periodStart: new Date(base + i * 60_000 - 86_400_000),
      periodEnd: new Date(base + i * 60_000),
      sessionsCount: 1,
      ticketsCount: 1,
      artifactKey: `insights/reports/seed-${i}.html`,
      artifactSize: 100,
      completedAt: new Date(base + i * 60_000),
    }));
    await prisma.insightsReport.createMany({ data: rows });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { reports: ReportListEntry[] };

    expect(body.reports.length).toBe(200);

    const generatedAts = body.reports.map((r) => new Date(r.generatedAt).getTime());
    const sorted = [...generatedAts].sort((a, b) => b - a);
    expect(generatedAts).toEqual(sorted);

    for (const entry of body.reports) {
      expect(entry).not.toHaveProperty('artifactKey');
    }
  });

  it('serializes expectedSessionsCount and coverageGapReason (AIB-852 FR-011/012)', async () => {
    requireAdminOrNotFound.mockResolvedValue({ ok: true, email: 'admin@e2e.local' });

    const now = new Date('2026-06-01T00:00:00Z');
    await prisma.insightsReport.create({
      data: {
        status: 'COMPLETED',
        generatedAt: now,
        periodStart: new Date(now.getTime() - 86_400_000),
        periodEnd: now,
        sessionsCount: 12,
        expectedSessionsCount: 16,
        coverageGapReason: 'TRANSCRIPT_NOT_AVAILABLE',
        ticketsCount: 9,
        artifactKey: 'insights/reports/gap.html',
        artifactSize: 100,
        completedAt: now,
      },
    });

    const res = await GET(makeRequest());
    const body = (await res.json()) as { reports: ReportListEntry[] };
    const entry = body.reports.find((r) => r.sessionsCount === 12);
    expect(entry).toBeDefined();
    expect(entry?.expectedSessionsCount).toBe(16);
    expect(entry?.coverageGapReason).toBe('TRANSCRIPT_NOT_AVAILABLE');
  });

  it('surfaces errorReason on FAILED entries; null on RUNNING', async () => {
    requireAdminOrNotFound.mockResolvedValue({ ok: true, email: 'admin@e2e.local' });

    const now = new Date('2026-05-11T12:00:00Z');
    await prisma.insightsReport.createMany({
      data: [
        {
          status: 'FAILED',
          generatedAt: now,
          periodStart: new Date(now.getTime() - 86_400_000),
          periodEnd: now,
          errorReason: 'Insights output validation failed',
          completedAt: now,
        },
        {
          status: 'RUNNING',
          generatedAt: new Date(now.getTime() + 10_000),
          periodStart: now,
          periodEnd: new Date(now.getTime() + 10_000),
        },
      ],
    });

    const res = await GET(makeRequest());
    const body = (await res.json()) as { reports: ReportListEntry[] };
    const running = body.reports.find((r) => r.status === 'RUNNING');
    const failed = body.reports.find((r) => r.status === 'FAILED');

    expect(failed?.errorReason).toBe('Insights output validation failed');
    expect(running?.errorReason).toBeNull();
  });

  it('runs reconciliation BEFORE the SELECT so backdated RUNNING rows surface as FAILED', async () => {
    requireAdminOrNotFound.mockResolvedValue({ ok: true, email: 'admin@e2e.local' });

    const longAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.insightsReport.create({
      data: {
        status: 'RUNNING',
        generatedAt: longAgo,
        periodStart: longAgo,
        periodEnd: longAgo,
        createdAt: longAgo,
      },
    });

    const res = await GET(makeRequest());
    const body = (await res.json()) as { reports: ReportListEntry[] };
    expect(body.reports.length).toBe(1);
    expect(body.reports[0].status).toBe('FAILED');
    expect(body.reports[0].errorReason).toMatch(/timed out/i);
  });

  it('response includes workflowRunId as string when Job has a run ID', async () => {
    requireAdminOrNotFound.mockResolvedValue({ ok: true, email: 'admin@e2e.local' });

    const now = new Date();
    const job = await prisma.job.create({
      data: {
        command: 'insights-analyze',
        status: 'COMPLETED',
        projectId: ctx.projectId,
        startedAt: now,
        completedAt: now,
        updatedAt: now,
        workflowRunId: BigInt('9876543210'),
      },
    });
    await prisma.insightsReport.create({
      data: {
        status: 'COMPLETED',
        generatedAt: now,
        periodStart: new Date(now.getTime() - 86_400_000),
        periodEnd: now,
        sessionsCount: 1,
        ticketsCount: 1,
        artifactKey: 'insights/reports/wf-test.html',
        artifactSize: 100,
        completedAt: now,
        jobId: job.id,
      },
    });

    const res = await GET(makeRequest());
    const body = (await res.json()) as { reports: ReportListEntry[] };
    const entry = body.reports.find((r) => r.workflowRunId === '9876543210');
    expect(entry).toBeDefined();
    expect(entry?.workflowRunId).toBe('9876543210');
  });

  it('response includes githubActionsUrl when env vars are configured', async () => {
    requireAdminOrNotFound.mockResolvedValue({ ok: true, email: 'admin@e2e.local' });

    const prevOwner = process.env.GITHUB_OWNER;
    const prevRepo = process.env.GITHUB_REPO;
    process.env.GITHUB_OWNER = 'test-org';
    process.env.GITHUB_REPO = 'test-repo';

    try {
      const now = new Date();
      const job = await prisma.job.create({
        data: {
          command: 'insights-analyze',
          status: 'COMPLETED',
          projectId: ctx.projectId,
          startedAt: now,
          completedAt: now,
          updatedAt: now,
          workflowRunId: BigInt('1111111111'),
        },
      });
      await prisma.insightsReport.create({
        data: {
          status: 'COMPLETED',
          generatedAt: now,
          periodStart: new Date(now.getTime() - 86_400_000),
          periodEnd: now,
          sessionsCount: 1,
          ticketsCount: 1,
          artifactKey: 'insights/reports/url-test.html',
          artifactSize: 100,
          completedAt: now,
          jobId: job.id,
        },
      });

      const res = await GET(makeRequest());
      const body = (await res.json()) as { reports: ReportListEntry[] };
      const entry = body.reports.find((r) => r.workflowRunId === '1111111111');
      expect(entry).toBeDefined();
      expect(entry?.githubActionsUrl).toBe(
        'https://github.com/test-org/test-repo/actions/runs/1111111111'
      );
    } finally {
      if (prevOwner !== undefined) process.env.GITHUB_OWNER = prevOwner;
      else delete process.env.GITHUB_OWNER;
      if (prevRepo !== undefined) process.env.GITHUB_REPO = prevRepo;
      else delete process.env.GITHUB_REPO;
    }
  });

  it('workflowRunId is null when Job has no run ID', async () => {
    requireAdminOrNotFound.mockResolvedValue({ ok: true, email: 'admin@e2e.local' });

    const now = new Date();
    const job = await prisma.job.create({
      data: {
        command: 'insights-analyze',
        status: 'COMPLETED',
        projectId: ctx.projectId,
        startedAt: now,
        completedAt: now,
        updatedAt: now,
      },
    });
    await prisma.insightsReport.create({
      data: {
        status: 'COMPLETED',
        generatedAt: now,
        periodStart: new Date(now.getTime() - 86_400_000),
        periodEnd: now,
        sessionsCount: 1,
        ticketsCount: 1,
        artifactKey: 'insights/reports/no-wf.html',
        artifactSize: 100,
        completedAt: now,
        jobId: job.id,
      },
    });

    const res = await GET(makeRequest());
    const body = (await res.json()) as { reports: ReportListEntry[] };
    const entry = body.reports.find((r) => (r as ReportListEntry).id > 0);
    expect(entry?.workflowRunId).toBeNull();
  });

  it('githubActionsUrl is null when env vars are missing', async () => {
    requireAdminOrNotFound.mockResolvedValue({ ok: true, email: 'admin@e2e.local' });

    const prevOwner = process.env.GITHUB_OWNER;
    const prevRepo = process.env.GITHUB_REPO;
    delete process.env.GITHUB_OWNER;
    delete process.env.GITHUB_REPO;

    try {
      const now = new Date();
      const job = await prisma.job.create({
        data: {
          command: 'insights-analyze',
          status: 'COMPLETED',
          projectId: ctx.projectId,
          startedAt: now,
          completedAt: now,
          updatedAt: now,
          workflowRunId: BigInt('5555555555'),
        },
      });
      await prisma.insightsReport.create({
        data: {
          status: 'COMPLETED',
          generatedAt: now,
          periodStart: new Date(now.getTime() - 86_400_000),
          periodEnd: now,
          sessionsCount: 1,
          ticketsCount: 1,
          artifactKey: 'insights/reports/no-env.html',
          artifactSize: 100,
          completedAt: now,
          jobId: job.id,
        },
      });

      const res = await GET(makeRequest());
      const body = (await res.json()) as { reports: ReportListEntry[] };
      const entry = body.reports.find((r) => r.workflowRunId === '5555555555');
      expect(entry).toBeDefined();
      expect(entry?.githubActionsUrl).toBeNull();
    } finally {
      if (prevOwner !== undefined) process.env.GITHUB_OWNER = prevOwner;
      if (prevRepo !== undefined) process.env.GITHUB_REPO = prevRepo;
    }
  });
});
