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
});
