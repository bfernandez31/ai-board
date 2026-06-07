import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { JobStatus } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

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

describe('Insights status PATCH writes per-session markers (AIB-856 T009)', () => {
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

  /** Create an eligible Claude session (COMPLETED job + ticket + rawArtifactKey). */
  async function createEligibleSession(offsetH: number): Promise<number> {
    const ticket = await ctx.createTicket({ title: `[e2e] session-${offsetH}` });
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

  /** Create a RUNNING report with its linked insights-analyze job. */
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

  it('COMPLETED writes one marker per accepted job and derives sessionsCount', async () => {
    const jobA = await createEligibleSession(0);
    const jobB = await createEligibleSession(1);
    const reportId = await createRunningReport();

    const res = await patchStatus(reportId, {
      status: 'COMPLETED',
      analyzedJobIds: [jobA, jobB],
      expectedSessionsCount: 2,
      ticketsCount: 2,
      artifactKey: `insights/reports/${reportId}.html`,
      artifactSize: 1234,
    });
    expect(res.status).toBe(200);

    const report = await prisma.insightsReport.findUnique({ where: { id: reportId } });
    expect(report?.status).toBe('COMPLETED');
    expect(report?.sessionsCount).toBe(2);
    expect(report?.expectedSessionsCount).toBe(2);

    const markers = await prisma.insightsAnalyzedSession.findMany({
      where: { reportId },
      orderBy: { jobId: 'asc' },
    });
    expect(markers.map((m) => m.jobId).sort((a, b) => a - b)).toEqual(
      [jobA, jobB].sort((a, b) => a - b)
    );
  });

  it('FAILED writes no markers (FR-006)', async () => {
    const jobA = await createEligibleSession(0);
    const reportId = await createRunningReport();

    const res = await patchStatus(reportId, {
      status: 'FAILED',
      errorReason: 'workflow exploded',
    });
    expect(res.status).toBe(200);

    const report = await prisma.insightsReport.findUnique({ where: { id: reportId } });
    expect(report?.status).toBe('FAILED');

    const markers = await prisma.insightsAnalyzedSession.findMany({ where: { jobId: jobA } });
    expect(markers).toHaveLength(0);
  });

  it('a late duplicate terminal PATCH is an idempotent no-op (no duplicate markers)', async () => {
    const jobA = await createEligibleSession(0);
    const reportId = await createRunningReport();

    const body = {
      status: 'COMPLETED' as const,
      analyzedJobIds: [jobA],
      expectedSessionsCount: 1,
      ticketsCount: 1,
      artifactKey: `insights/reports/${reportId}.html`,
      artifactSize: 1234,
    };

    const first = await patchStatus(reportId, body);
    expect(first.status).toBe(200);
    const second = await patchStatus(reportId, body);
    expect(second.status).toBe(200);

    const markers = await prisma.insightsAnalyzedSession.findMany({ where: { jobId: jobA } });
    expect(markers).toHaveLength(1);
  });

  it('filters out non-eligible analyzedJobIds (marker-poisoning defense, P-4)', async () => {
    const eligible = await createEligibleSession(0);
    const reportId = await createRunningReport();
    // 999999 is not an eligible Claude session — must be filtered out.
    const res = await patchStatus(reportId, {
      status: 'COMPLETED',
      analyzedJobIds: [eligible, 999999],
      expectedSessionsCount: 2,
      ticketsCount: 1,
      artifactKey: `insights/reports/${reportId}.html`,
      artifactSize: 1234,
    });
    expect(res.status).toBe(200);

    const report = await prisma.insightsReport.findUnique({ where: { id: reportId } });
    // sessionsCount derives from the eligible (marked) subset only.
    expect(report?.sessionsCount).toBe(1);
    expect(report?.expectedSessionsCount).toBe(2);

    const markers = await prisma.insightsAnalyzedSession.findMany({ where: { reportId } });
    expect(markers.map((m) => m.jobId)).toEqual([eligible]);
  });

  it('COMPLETED with no eligible analyzedJobIds transitions to FAILED (no markers)', async () => {
    const reportId = await createRunningReport();
    const res = await patchStatus(reportId, {
      status: 'COMPLETED',
      analyzedJobIds: [999999],
      expectedSessionsCount: 1,
      ticketsCount: 0,
      artifactKey: `insights/reports/${reportId}.html`,
      artifactSize: 1234,
    });
    expect(res.status).toBe(200);

    const report = await prisma.insightsReport.findUnique({ where: { id: reportId } });
    expect(report?.status).toBe('FAILED');
    expect(report?.errorReason).toBe('No readable Claude sessions available');

    const markers = await prisma.insightsAnalyzedSession.findMany({ where: { reportId } });
    expect(markers).toHaveLength(0);
  });
});
