import { beforeEach, describe, expect, it } from 'vitest';
import { JobStatus } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { listAnalyzableClaudeSessions } from '@/app/lib/insights/predicate';
import { advanceCoverage } from '@/app/lib/insights/repository';

/**
 * AIB-852 US2 — exactly-once coverage across consecutive runs.
 *
 * Selection correctness comes from the per-session coverage marker
 * (`InsightsSessionCoverage`) plus the half-open `completion < periodEnd`
 * upper bound (D7). These tests drive selection through the real predicate
 * and advance coverage through the real repository helper.
 */
describe('insights coverage — exactly once across runs (US2)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    await prisma.insightsReport.deleteMany({});
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { defaultAgent: 'CLAUDE' },
    });
  });

  async function seedSession(completedAt: Date): Promise<number> {
    const ticket = await ctx.createTicket({ title: '[e2e] cov-session' });
    await prisma.ticket.update({ where: { id: ticket.id }, data: { agent: 'CLAUDE' } });
    const job = await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        command: 'implement',
        status: JobStatus.COMPLETED,
        startedAt: completedAt,
        completedAt,
        updatedAt: completedAt,
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

  async function createCompletedRun(periodEnd: Date, analyzedJobIds: number[]) {
    const report = await prisma.insightsReport.create({
      data: {
        status: 'COMPLETED',
        generatedAt: periodEnd,
        periodStart: new Date(periodEnd.getTime() - 86_400_000),
        periodEnd,
        sessionsCount: analyzedJobIds.length,
        expectedSessionsCount: analyzedJobIds.length,
        ticketsCount: analyzedJobIds.length,
        artifactKey: `insights/reports/cov-${periodEnd.getTime()}.html`,
        artifactSize: 1,
        completedAt: periodEnd,
      },
    });
    await advanceCoverage(prisma, report.id, analyzedJobIds);
    return report;
  }

  it('a boundary session is covered in exactly one of two consecutive runs (US2 AC1/SC-002)', async () => {
    const boundary = new Date('2026-05-10T00:00:00Z');
    const jobId = await seedSession(boundary);

    // Run A ends exactly at the boundary: half-open `completion < end` EXCLUDES it.
    const runA = await listAnalyzableClaudeSessions({ start: null, end: boundary });
    expect(runA.map((j) => j.jobId)).not.toContain(jobId);

    // Run B (periodEnd = later) picks it up — uncovered + before the new bound.
    const later = new Date('2026-05-11T00:00:00Z');
    const runB = await listAnalyzableClaudeSessions({ start: null, end: later });
    expect(runB.map((j) => j.jobId)).toContain(jobId);
  });

  it('a covered session is not re-selected by the next run (US2 AC2)', async () => {
    const at = new Date('2026-05-09T00:00:00Z');
    const jobId = await seedSession(at);

    // Run A selects and covers it.
    const runA = await listAnalyzableClaudeSessions({ start: null, end: new Date('2026-05-10T00:00:00Z') });
    expect(runA.map((j) => j.jobId)).toContain(jobId);
    await createCompletedRun(new Date('2026-05-10T00:00:00Z'), [jobId]);

    // Run B must NOT re-select the covered session.
    const runB = await listAnalyzableClaudeSessions({ start: null, end: new Date('2026-05-12T00:00:00Z') });
    expect(runB.map((j) => j.jobId)).not.toContain(jobId);
  });

  it('after a FAILED run the intended sessions are picked up by the next run (US2 AC3/SC-003)', async () => {
    const at = new Date('2026-05-09T00:00:00Z');
    const jobId = await seedSession(at);

    // Simulate a FAILED run: a FAILED report advances NO coverage.
    await prisma.insightsReport.create({
      data: {
        status: 'FAILED',
        generatedAt: new Date('2026-05-10T00:00:00Z'),
        periodStart: at,
        periodEnd: new Date('2026-05-10T00:00:00Z'),
        errorReason: 'workflow failed',
        completedAt: new Date('2026-05-10T00:00:00Z'),
      },
    });

    // The next run still sees the session (no coverage was written).
    const next = await listAnalyzableClaudeSessions({ start: null, end: new Date('2026-05-12T00:00:00Z') });
    expect(next.map((j) => j.jobId)).toContain(jobId);
  });

  it('every captured session of a multi-session ticket is enumerated, then covered together', async () => {
    const ticket = await ctx.createTicket({ title: '[e2e] cov-multi' });
    await prisma.ticket.update({ where: { id: ticket.id }, data: { agent: 'CLAUDE' } });
    const jobIds: number[] = [];
    for (const day of ['2026-05-01', '2026-05-03', '2026-05-05']) {
      const at = new Date(`${day}T00:00:00Z`);
      const job = await prisma.job.create({
        data: {
          ticketId: ticket.id,
          projectId: ctx.projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: at,
          completedAt: at,
          updatedAt: at,
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
      jobIds.push(job.id);
    }

    const end = new Date('2026-05-10T00:00:00Z');
    const runA = await listAnalyzableClaudeSessions({ start: null, end });
    // All three sessions of the one ticket — no per-ticket dedup (FR-001/002).
    expect(runA.map((j) => j.jobId).sort()).toEqual([...jobIds].sort());

    await createCompletedRun(end, jobIds);
    const runB = await listAnalyzableClaudeSessions({ start: null, end: new Date('2026-05-12T00:00:00Z') });
    for (const id of jobIds) {
      expect(runB.map((j) => j.jobId)).not.toContain(id);
    }
  });
});
