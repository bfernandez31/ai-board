import type {
  InsightsCoverageGapReason,
  InsightsReport,
  InsightsRunStatus,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { getEarliestClaudeSessionCompletion } from '@/app/lib/insights/predicate';

/**
 * Data-access helpers for `InsightsReport`. Status transitions ALWAYS go
 * through atomic `updateMany` with a `WHERE status='RUNNING'` guard (P-1) so
 * late workflow callbacks cannot flip a row backwards (FR-014, SC-012).
 *
 * AIB-852: `derivePeriodStart` (max covered completion ?? oldest available
 * session completion ?? now — D7/FR-014) supersedes the global-cursor
 * `periodStart` decision; `advanceCoverage` records the per-session coverage
 * marker inside the COMPLETED transaction (FR-007). The earliest-session
 * source comes from the shared predicate file (P1) so it cannot drift from
 * the workflow's enumeration.
 */

const LIST_DEFAULT_LIMIT = 200;

export { getEarliestClaudeSessionCompletion };

/**
 * Insert one `InsightsSessionCoverage` row per analyzed job, idempotently
 * (`skipDuplicates` on the unique `jobId`). Called ONLY inside the
 * RUNNING→COMPLETED transaction (FR-007); a FAILED run never calls this.
 * A re-delivered COMPLETED callback or explicit re-analysis is a no-op.
 */
export async function advanceCoverage(
  tx: Prisma.TransactionClient,
  reportId: number,
  jobIds: number[]
): Promise<void> {
  if (jobIds.length === 0) return;
  await tx.insightsSessionCoverage.createMany({
    data: jobIds.map((jobId) => ({ jobId, reportId })),
    skipDuplicates: true,
  });
}

/**
 * Derived (descriptive) `periodStart` for a fresh run (D7, FR-014):
 *   1. the max completion among already-covered sessions, else
 *   2. the oldest available Claude session's completion (first run), else
 *   3. `now`.
 *
 * This value is stored for display and explicit-period re-analysis only;
 * selection correctness comes from the coverage marker + half-open `periodEnd`
 * upper bound, NOT from `periodStart`.
 */
export async function derivePeriodStart(now: Date = new Date()): Promise<Date> {
  const covered = await prisma.insightsSessionCoverage.findMany({
    select: {
      job: {
        select: { completedAt: true, updatedAt: true, startedAt: true },
      },
    },
  });
  if (covered.length > 0) {
    let max: Date | null = null;
    for (const row of covered) {
      const job = row.job;
      if (!job) continue;
      const completion = job.completedAt ?? job.updatedAt ?? job.startedAt;
      if (max === null || completion > max) max = completion;
    }
    if (max !== null) return max;
  }
  const earliest = await getEarliestClaudeSessionCompletion();
  return earliest ?? now;
}

/**
 * Sentinel thrown by `createRunningReportAndJob` when the partial-unique
 * index on `status='RUNNING'` rejects a concurrent insert. The trigger
 * handler maps this to an `ALREADY_RUNNING` refusal so the gate is enforced
 * atomically at the database layer rather than via a TOCTOU read.
 */
export class InsightsAlreadyRunningError extends Error {
  constructor() {
    super('Another insights run is already in progress');
    this.name = 'InsightsAlreadyRunningError';
  }
}

export async function getLastCompletedRunEnd(): Promise<Date | null> {
  const row = await prisma.insightsReport.findFirst({
    where: { status: 'COMPLETED' },
    orderBy: { periodEnd: 'desc' },
    select: { periodEnd: true },
  });
  return row?.periodEnd ?? null;
}

export async function listReports(
  limit: number = LIST_DEFAULT_LIMIT
) {
  return prisma.insightsReport.findMany({
    orderBy: { generatedAt: 'desc' },
    take: Math.min(Math.max(1, limit), LIST_DEFAULT_LIMIT),
    include: { job: { select: { workflowRunId: true } } },
  });
}

export async function getReportById(id: number) {
  return prisma.insightsReport.findUnique({
    where: { id },
    include: { job: { select: { workflowRunId: true } } },
  });
}

export async function getRunningReport(): Promise<InsightsReport | null> {
  return prisma.insightsReport.findFirst({ where: { status: 'RUNNING' } });
}

/**
 * Single-transaction insert of an `InsightsReport` and its driving `Job`.
 * Used by `POST /api/admin/insights/trigger` so the high-water mark cannot
 * change between read and insert (D-13) and so there is never a `Job`
 * without a matching `InsightsReport` (or vice versa).
 *
 * Throws if any step fails — the trigger handler's catch wraps the
 * Octokit dispatch only, NOT this transaction.
 */
export async function createRunningReportAndJob(args: {
  periodStart: Date;
  periodEnd: Date;
  now: Date;
  projectId: number;
}): Promise<{ report: InsightsReport; jobId: number }> {
  try {
    return await prisma.$transaction(async (tx) => {
      const report = await tx.insightsReport.create({
        data: {
          status: 'RUNNING',
          generatedAt: args.now,
          periodStart: args.periodStart,
          periodEnd: args.periodEnd,
          createdAt: args.now,
        },
      });

      const job = await tx.job.create({
        data: {
          command: 'insights-analyze',
          status: 'PENDING',
          ticketId: null,
          projectId: args.projectId,
          startedAt: args.now,
          updatedAt: args.now,
        },
      });

      const linked = await tx.insightsReport.update({
        where: { id: report.id },
        data: { jobId: job.id },
      });

      return { report: linked, jobId: job.id };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new InsightsAlreadyRunningError();
    }
    throw error;
  }
}

/**
 * Atomic conditional transition of a RUNNING row to FAILED. Returns true
 * iff this call actually flipped the row (P-1; late callbacks see count=0).
 */
export async function markFailed(
  id: number,
  reason: string,
  now: Date = new Date()
): Promise<boolean> {
  const result = await prisma.insightsReport.updateMany({
    where: { id, status: 'RUNNING' },
    data: {
      status: 'FAILED',
      errorReason: reason.slice(0, 500),
      completedAt: now,
    },
  });
  return result.count > 0;
}

/**
 * Shape returned by `/api/admin/insights/reports` and
 * `/api/admin/insights/reports/:id`. `artifactKey` is excluded by design
 * (FR-024 — clients fetch the HTML by id via the `/html` endpoint).
 */
export interface ReportListEntry {
  id: number;
  status: InsightsRunStatus;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  /** AIB-852: count of *analyzed* sessions (transcript fetched). */
  sessionsCount: number | null;
  /** AIB-852: in-scope sessions incl. those lacking a transcript (FR-011). */
  expectedSessionsCount: number | null;
  /** AIB-852: set when analyzed < expected (FR-012). */
  coverageGapReason: InsightsCoverageGapReason | null;
  ticketsCount: number | null;
  artifactSize: number | null;
  errorReason: string | null;
  completedAt: string | null;
  createdAt: string;
  workflowRunId: string | null;
  githubActionsUrl: string | null;
}

export function buildGithubActionsUrl(
  workflowRunId: bigint | null | undefined,
  owner?: string,
  repo?: string
): string | null {
  if (!workflowRunId || !owner || !repo) return null;
  return `https://github.com/${owner}/${repo}/actions/runs/${String(workflowRunId)}`;
}

type ReportWithJob = InsightsReport & {
  job?: { workflowRunId: bigint | null } | null;
};

export function toListEntry(
  row: ReportWithJob,
  owner?: string,
  repo?: string
): ReportListEntry {
  const workflowRunId = row.job?.workflowRunId ?? null;
  return {
    id: row.id,
    status: row.status,
    generatedAt: row.generatedAt.toISOString(),
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    sessionsCount: row.sessionsCount,
    expectedSessionsCount: row.expectedSessionsCount,
    coverageGapReason: row.coverageGapReason,
    ticketsCount: row.ticketsCount,
    artifactSize: row.artifactSize,
    errorReason: row.errorReason,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    workflowRunId: workflowRunId ? String(workflowRunId) : null,
    githubActionsUrl: buildGithubActionsUrl(workflowRunId, owner, repo),
  };
}
