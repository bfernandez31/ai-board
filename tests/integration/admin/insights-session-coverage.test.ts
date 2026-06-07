/**
 * AIB-856 T010 (NEW, justified in research.md §"New test file"):
 * per-session coverage accounting across consecutive runs.
 *
 * Covers US2 (no gap / no overlap across two runs, boundary session, failed run
 * leaves sessions eligible) and US4 (expected vs analyzed, pruned-transcript
 * gap). No existing file covers per-session coverage; folding this into
 * insights-api.test.ts would mix unrelated concerns.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { JobStatus } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { listEligibleUnanalyzedSessions } from '@/app/lib/insights/predicate';

const { validateWorkflowAuth, streamInsightsReportArtifact, validateInsightsOutput } =
  vi.hoisted(() => ({
    validateWorkflowAuth: vi.fn(),
    streamInsightsReportArtifact: vi.fn(),
    validateInsightsOutput: vi.fn(),
  }));

vi.mock('@/app/lib/auth/workflow-auth', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, validateWorkflowAuth };
});
vi.mock('@/app/lib/blob/client', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, streamInsightsReportArtifact };
});
vi.mock('@/app/lib/insights/output-validation', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, validateInsightsOutput };
});

import { PATCH } from '@/app/api/admin/insights/reports/[id]/status/route';

function htmlStream(html: string) {
  return {
    stream: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(html));
        controller.close();
      },
    }),
    contentType: 'text/html; charset=utf-8',
    size: html.length,
  };
}

describe('Insights per-session coverage across runs (AIB-856 T010)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    validateWorkflowAuth.mockReset();
    validateWorkflowAuth.mockReturnValue({ isValid: true });
    streamInsightsReportArtifact.mockReset();
    streamInsightsReportArtifact.mockResolvedValue(htmlStream('<html>ok</html>'));
    validateInsightsOutput.mockReset();
    validateInsightsOutput.mockReturnValue({ ok: true });
  });

  async function createEligibleSession(offsetH: number): Promise<number> {
    const ticket = await ctx.createTicket({ title: `[e2e] cov-${offsetH}` });
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

  async function createRunningReport(): Promise<number> {
    const now = new Date();
    const driver = await prisma.job.create({
      data: {
        command: 'insights-analyze',
        status: JobStatus.RUNNING,
        ticketId: null,
        projectId: ctx.projectId,
        startedAt: now,
        updatedAt: now,
      },
    });
    const report = await prisma.insightsReport.create({
      data: {
        status: 'RUNNING',
        generatedAt: now,
        periodStart: now,
        periodEnd: now,
        createdAt: now,
        jobId: driver.id,
      },
    });
    return report.id;
  }

  async function patchStatus(id: number, body: unknown): Promise<Response> {
    const req = new NextRequest(
      `http://localhost/api/admin/insights/reports/${id}/status`,
      {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );
    return PATCH(req, { params: Promise.resolve({ id: String(id) }) });
  }

  /**
   * Simulate one analysis run: enumerate eligible-unanalyzed sessions, then
   * PATCH COMPLETED marking the readable subset (default: all enumerated).
   */
  async function runAnalysis(
    pickReadable: (ids: number[]) => number[] = (ids) => ids
  ): Promise<{ reportId: number; enumerated: number[]; analyzed: number[] }> {
    const reportId = await createRunningReport();
    const enumerated = (await listEligibleUnanalyzedSessions()).map((j) => j.jobId);
    const analyzed = pickReadable(enumerated);
    await patchStatus(reportId, {
      status: 'COMPLETED',
      analyzedJobIds: analyzed,
      expectedSessionsCount: enumerated.length,
      ticketsCount: analyzed.length,
      artifactKey: `insights/reports/${reportId}.html`,
      artifactSize: 1234,
    });
    return { reportId, enumerated, analyzed };
  }

  it('two consecutive runs analyze every session exactly once — no gap, no overlap, boundary safe', async () => {
    const s1 = await createEligibleSession(0);
    const s2 = await createEligibleSession(1);

    const runA = await runAnalysis();
    expect(runA.enumerated.sort((a, b) => a - b)).toEqual([s1, s2].sort((a, b) => a - b));

    // A boundary session arrives AFTER run A completed.
    const s3 = await createEligibleSession(2);

    const runB = await runAnalysis();
    // Run B enumerates ONLY the new session (s1/s2 already marked).
    expect(runB.enumerated).toEqual([s3]);

    // Every session is covered by exactly one run (no overlap, no gap).
    const allMarkers = await prisma.insightsAnalyzedSession.findMany({
      orderBy: { jobId: 'asc' },
    });
    const coveredJobIds = allMarkers.map((m) => m.jobId).sort((a, b) => a - b);
    expect(coveredJobIds).toEqual([s1, s2, s3].sort((a, b) => a - b));
    // jobId is unique → no session marked twice.
    expect(new Set(coveredJobIds).size).toBe(coveredJobIds.length);
    // s3 belongs to run B, s1/s2 to run A.
    const byJob = new Map(allMarkers.map((m) => [m.jobId, m.reportId]));
    expect(byJob.get(s3)).toBe(runB.reportId);
    expect(byJob.get(s1)).toBe(runA.reportId);

    // Nothing remains eligible.
    expect(await listEligibleUnanalyzedSessions()).toHaveLength(0);
  });

  it('a failed run leaves its sessions eligible for the next run (FR-006, US2-AC3)', async () => {
    const s1 = await createEligibleSession(0);
    const reportId = await createRunningReport();

    await patchStatus(reportId, { status: 'FAILED', errorReason: 'boom' });

    const stillEligible = (await listEligibleUnanalyzedSessions()).map((j) => j.jobId);
    expect(stillEligible).toContain(s1);
    expect(await prisma.insightsAnalyzedSession.findMany({ where: { jobId: s1 } })).toHaveLength(0);
  });

  it('a pruned transcript is counted in expected but not analyzed, and stays eligible (US4, FR-009/011)', async () => {
    const s1 = await createEligibleSession(0);
    const s2 = await createEligibleSession(1);
    const s3 = await createEligibleSession(2);

    // s3's transcript is "pruned" at download time → not in the readable set.
    const run = await runAnalysis((ids) => ids.filter((id) => id !== s3));

    const report = await prisma.insightsReport.findUnique({ where: { id: run.reportId } });
    expect(report?.expectedSessionsCount).toBe(3);
    expect(report?.sessionsCount).toBe(2); // analyzed (readable) subset
    // gap = expected - analyzed = 1
    expect((report?.expectedSessionsCount ?? 0) - (report?.sessionsCount ?? 0)).toBe(1);

    // The pruned session was NOT marked → it remains eligible for a later run.
    const stillEligible = (await listEligibleUnanalyzedSessions()).map((j) => j.jobId);
    expect(stillEligible).toEqual([s3]);
    // s1/s2 were covered.
    const covered = (
      await prisma.insightsAnalyzedSession.findMany({ where: { reportId: run.reportId } })
    )
      .map((m) => m.jobId)
      .sort((a, b) => a - b);
    expect(covered).toEqual([s1, s2].sort((a, b) => a - b));
  });
});
