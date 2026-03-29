import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { GET } from '@/app/api/projects/[projectId]/health/last-clean/route';

vi.mock('@/lib/db/auth-helpers', () => ({
  verifyProjectAccess: vi.fn(async () => undefined),
}));

describe('Last Clean Details GET Endpoint', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  function makeRequest(projectId: number) {
    return GET(
      new NextRequest(`http://localhost/api/projects/${projectId}/health/last-clean`),
      { params: Promise.resolve({ projectId: String(projectId) }) }
    );
  }

  async function createCleanTicket() {
    return prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        ticketKey: `E2E-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: '[e2e] Clean test ticket',
        workflowType: 'CLEAN',
        stage: 'SHIP',
      },
    });
  }

  async function createCleanJob(ticketId: number, overrides: {
    completedAt?: Date;
    status?: string;
    logs?: string | null;
  } = {}) {
    return prisma.job.create({
      data: {
        ticketId,
        command: 'clean',
        status: overrides.status ?? 'COMPLETED',
        completedAt: overrides.completedAt ?? new Date(),
        logs: overrides.logs ?? null,
      },
    });
  }

  it('returns empty state when no completed cleanup jobs exist', async () => {
    const response = await makeRequest(ctx.projectId);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.lastCleanDate).toBeNull();
    expect(data.stalenessStatus).toBeNull();
    expect(data.daysSinceClean).toBeNull();
    expect(data.filesCleaned).toBeNull();
    expect(data.remainingIssues).toBeNull();
    expect(data.summary).toBeNull();
    expect(data.history).toEqual([]);
  });

  it('returns correct staleness "ok" for recent cleanup (<30 days)', async () => {
    const ticket = await createCleanTicket();
    await createCleanJob(ticket.id, {
      completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    expect(data.stalenessStatus).toBe('ok');
    expect(data.daysSinceClean).toBe(5);
  });

  it('returns correct staleness "warning" for aging cleanup (30-60 days)', async () => {
    const ticket = await createCleanTicket();
    await createCleanJob(ticket.id, {
      completedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
    });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    expect(data.stalenessStatus).toBe('warning');
    expect(data.daysSinceClean).toBe(45);
  });

  it('returns correct staleness "alert" for stale cleanup (>60 days)', async () => {
    const ticket = await createCleanTicket();
    await createCleanJob(ticket.id, {
      completedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    expect(data.stalenessStatus).toBe('alert');
    expect(data.daysSinceClean).toBe(90);
  });

  it('parses structured cleanup data from job output', async () => {
    const ticket = await createCleanTicket();
    await createCleanJob(ticket.id, {
      logs: JSON.stringify({
        filesCleaned: 12,
        remainingIssues: 3,
        summary: 'Cleaned 12 files, 3 remaining issues',
      }),
    });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    expect(data.filesCleaned).toBe(12);
    expect(data.remainingIssues).toBe(3);
    expect(data.summary).toBe('Cleaned 12 files, 3 remaining issues');
  });

  it('returns null fields when job output has no structured data', async () => {
    const ticket = await createCleanTicket();
    await createCleanJob(ticket.id, {
      logs: 'Cleanup completed successfully',
    });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    expect(data.filesCleaned).toBeNull();
    expect(data.remainingIssues).toBeNull();
    expect(data.summary).toBeNull();
    expect(data.lastCleanDate).not.toBeNull();
  });

  it('returns chronological cleanup history', async () => {
    const ticket1 = await createCleanTicket();
    const ticket2 = await createCleanTicket();

    const olderJob = await createCleanJob(ticket1.id, {
      completedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      logs: JSON.stringify({ filesCleaned: 5 }),
    });
    const newerJob = await createCleanJob(ticket2.id, {
      completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      logs: JSON.stringify({ filesCleaned: 8 }),
    });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    expect(data.history).toHaveLength(2);
    // Most recent first (desc order)
    expect(data.history[0].jobId).toBe(newerJob.id);
    expect(data.history[0].filesCleaned).toBe(8);
    expect(data.history[1].jobId).toBe(olderJob.id);
    expect(data.history[1].filesCleaned).toBe(5);
  });

  it('ignores RUNNING cleanup jobs', async () => {
    const ticket1 = await createCleanTicket();
    const ticket2 = await createCleanTicket();

    await createCleanJob(ticket1.id, {
      completedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      status: 'COMPLETED',
    });
    await createCleanJob(ticket2.id, {
      status: 'RUNNING',
      completedAt: null as unknown as Date,
    });

    const response = await makeRequest(ctx.projectId);
    const data = await response.json();

    expect(data.history).toHaveLength(1);
    expect(data.stalenessStatus).toBe('ok');
  });

  it('returns 400 for invalid project ID', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/projects/invalid/health/last-clean'),
      { params: Promise.resolve({ projectId: 'invalid' }) }
    );
    expect(response.status).toBe(400);
  });
});
