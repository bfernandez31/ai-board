import { prisma } from '@/lib/db/client';
import type { InsightsReport } from '@prisma/client';

export interface InsightsScopePreview {
  /** Cutoff time used to decide "new since". Null when no previous successful run exists. */
  previousRunAt: Date | null;
  /** Number of TicketOutcome rows shipped strictly after `previousRunAt`. */
  newTicketCount: number;
  /** Whether a fresh analysis can run (i.e. at least one new shipped ticket). */
  hasNewTickets: boolean;
}

export interface InsightsScope extends InsightsScopePreview {
  periodStart: Date | null;
  periodEnd: Date;
  ticketIds: number[];
  /** CLAUDE jobs in scope that have a captured raw native session artifact. */
  jobs: Array<{
    jobId: number;
    projectId: number;
    ticketId: number;
    rawArtifactKey: string;
  }>;
}

export async function findLatestSuccessfulReport(): Promise<InsightsReport | null> {
  return prisma.insightsReport.findFirst({
    where: { status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
  });
}

export async function findActiveInsightsReport(): Promise<InsightsReport | null> {
  return prisma.insightsReport.findFirst({
    where: { status: 'RUNNING' },
    orderBy: { startedAt: 'desc' },
  });
}

export async function previewInsightsScope(): Promise<InsightsScopePreview> {
  const previous = await findLatestSuccessfulReport();
  const previousRunAt = previous?.periodEnd ?? null;

  const newTicketCount = await prisma.ticketOutcome.count({
    where: previousRunAt ? { shippedAt: { gt: previousRunAt } } : {},
  });

  return {
    previousRunAt,
    newTicketCount,
    hasNewTickets: newTicketCount > 0,
  };
}

export async function buildInsightsScope(now: Date = new Date()): Promise<InsightsScope> {
  const preview = await previewInsightsScope();

  const outcomes = await prisma.ticketOutcome.findMany({
    where: preview.previousRunAt
      ? { shippedAt: { gt: preview.previousRunAt } }
      : {},
    select: { ticketId: true, shippedAt: true },
    orderBy: { shippedAt: 'asc' },
  });

  const ticketIds = outcomes.map((o) => o.ticketId);
  const periodStart =
    preview.previousRunAt ?? (outcomes[0]?.shippedAt ?? null);
  const periodEnd = now;

  const jobRows = ticketIds.length
    ? await prisma.job.findMany({
        where: {
          ticketId: { in: ticketIds },
          ticket: { agent: 'CLAUDE' },
          log: {
            captureStatus: 'CAPTURED',
            rawArtifactKey: { not: null },
          },
        },
        select: {
          id: true,
          projectId: true,
          ticketId: true,
          log: { select: { rawArtifactKey: true } },
        },
      })
    : [];

  const jobs: InsightsScope['jobs'] = [];
  for (const row of jobRows) {
    const rawArtifactKey = row.log?.rawArtifactKey;
    if (!rawArtifactKey) continue;
    jobs.push({
      jobId: row.id,
      projectId: row.projectId,
      ticketId: row.ticketId,
      rawArtifactKey,
    });
  }

  return {
    ...preview,
    periodStart,
    periodEnd,
    ticketIds,
    jobs,
  };
}

export function buildInsightsReportArtifactKey(reportId: number): string {
  return `insights/${reportId}.html`;
}
