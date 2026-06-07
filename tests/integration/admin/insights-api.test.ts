import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { JobStatus } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { computePreflightSnapshot } from '@/app/lib/insights/preflight';

const { validateWorkflowAuth } = vi.hoisted(() => ({
  validateWorkflowAuth: vi.fn(),
}));

vi.mock('@/app/lib/auth/workflow-auth', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, validateWorkflowAuth };
});

import { GET as getJobs } from '@/app/api/admin/insights/jobs/route';

describe('Insights marker-driven preflight + enumeration (AIB-856 T011)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    validateWorkflowAuth.mockReset();
    validateWorkflowAuth.mockReturnValue({ isValid: true });
  });

  /** Eligible Claude session; returns the created job id. */
  async function createEligibleSession(offsetH: number): Promise<number> {
    const ticket = await ctx.createTicket({ title: `[e2e] s-${offsetH}` });
    const started = new Date(2026, 4, 5, offsetH);
    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        command: 'implement',
        status: JobStatus.COMPLETED,
        startedAt: started,
        completedAt: started,
        updatedAt: started,
      },
    });
    await prisma.jobLog.create({
      data: {
        jobId: job.id,
        captureStatus: 'CAPTURED',
        preview: '',
        rawArtifactKey: `raw-logs/${ctx.projectId}/${ticket.id}/${job.id}.jsonl.gz`,
        rawArtifactSize: 1,
      },
    });
    return job.id;
  }

  async function createCompletedReport(): Promise<number> {
    const now = new Date('2026-06-01T12:00:00Z');
    const report = await prisma.insightsReport.create({
      data: {
        status: 'COMPLETED',
        generatedAt: now,
        periodStart: now,
        periodEnd: now,
        completedAt: now,
        createdAt: now,
        sessionsCount: 0,
      },
    });
    return report.id;
  }

  it('preflight refuses NO_CLAUDE_SESSIONS with no eligible sessions and no prior run', async () => {
    const snapshot = await computePreflightSnapshot();
    expect(snapshot.canTrigger).toBe(false);
    expect(snapshot.refusal?.refusalCode).toBe('NO_CLAUDE_SESSIONS');
    expect(snapshot.eligibleSessionsSincePreviousRun).toBe(0);
  });

  it('preflight allows triggering and counts eligible-unanalyzed sessions', async () => {
    await createEligibleSession(0);
    await createEligibleSession(1);
    const snapshot = await computePreflightSnapshot();
    expect(snapshot.canTrigger).toBe(true);
    expect(snapshot.refusal).toBeNull();
    expect(snapshot.eligibleSessionsSincePreviousRun).toBe(2);
  });

  it('preflight refuses NO_NEW_SESSIONS when all eligible sessions are analyzed and a prior run exists', async () => {
    const jobA = await createEligibleSession(0);
    const reportId = await createCompletedReport();
    // Mark the only session as analyzed → 0 eligible-unanalyzed remain.
    await prisma.insightsAnalyzedSession.create({
      data: { jobId: jobA, reportId },
    });

    const snapshot = await computePreflightSnapshot();
    expect(snapshot.canTrigger).toBe(false);
    expect(snapshot.refusal?.refusalCode).toBe('NO_NEW_SESSIONS');
    expect(snapshot.previousRunEnd).not.toBeNull();
  });

  it('enumeration lists all eligible-unanalyzed sessions and excludes analyzed ones', async () => {
    const jobA = await createEligibleSession(0);
    const jobB = await createEligibleSession(1);
    const reportId = await createCompletedReport();
    // Mark jobA as analyzed; only jobB should be enumerated.
    await prisma.insightsAnalyzedSession.create({ data: { jobId: jobA, reportId } });

    const req = new NextRequest('http://localhost/api/admin/insights/jobs', {
      headers: { Authorization: 'Bearer test-token' },
    });
    const res = await getJobs(req);
    const body = (await res.json()) as { jobs: { jobId: number }[] };
    expect(body.jobs.map((j) => j.jobId)).toEqual([jobB]);
  });
});
