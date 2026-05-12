import type { InsightsReport, InsightsRunStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { getEarliestClaudeJobTimestamp } from '@/app/lib/insights/predicate';

/**
 * Data-access helpers for `InsightsReport`. Status transitions ALWAYS go
 * through atomic `updateMany` with a `WHERE status='RUNNING'` guard (P-1) so
 * late workflow callbacks cannot flip a row backwards (FR-014, SC-012).
 *
 * `getLastCompletedRunEnd` and `getEarliestClaudeJobTimestamp` are the two
 * sources for the trigger endpoint's `periodStart` decision (D-13). The
 * earliest-Claude-timestamp source comes from the shared predicate file
 * (D-6) so its definition cannot drift from the workflow's enumeration.
 */

const LIST_DEFAULT_LIMIT = 200;

export { getEarliestClaudeJobTimestamp };

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
): Promise<InsightsReport[]> {
  return prisma.insightsReport.findMany({
    orderBy: { generatedAt: 'desc' },
    take: Math.min(Math.max(1, limit), LIST_DEFAULT_LIMIT),
  });
}

export async function getReportById(id: number): Promise<InsightsReport | null> {
  return prisma.insightsReport.findUnique({ where: { id } });
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
  sessionsCount: number | null;
  ticketsCount: number | null;
  artifactSize: number | null;
  errorReason: string | null;
  completedAt: string | null;
  createdAt: string;
}

export function toListEntry(row: InsightsReport): ReportListEntry {
  return {
    id: row.id,
    status: row.status,
    generatedAt: row.generatedAt.toISOString(),
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    sessionsCount: row.sessionsCount,
    ticketsCount: row.ticketsCount,
    artifactSize: row.artifactSize,
    errorReason: row.errorReason,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
