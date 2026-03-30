import { prisma } from '@/lib/db/client';
import type { LastCleanAggregate, LastCleanHistoryItem } from './types';

function parseCleanupLogs(logs: string | null): { filesCleaned: number; remainingIssues: number; summary: string } {
  if (!logs) return { filesCleaned: 0, remainingIssues: 0, summary: '' };
  try {
    const parsed = JSON.parse(logs);
    return {
      filesCleaned: typeof parsed.filesCleaned === 'number' ? parsed.filesCleaned : 0,
      remainingIssues: typeof parsed.remainingIssues === 'number' ? parsed.remainingIssues : 0,
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    };
  } catch {
    return { filesCleaned: 0, remainingIssues: 0, summary: '' };
  }
}

/**
 * Compute the Last Clean aggregate for a project.
 * Queries completed clean jobs, extracts files/issues from logs,
 * computes staleness, and returns history of up to 10 recent jobs.
 */
export async function getLastCleanAggregate(projectId: number): Promise<LastCleanAggregate> {
  const jobs = await prisma.job.findMany({
    where: {
      ticket: { projectId },
      command: 'clean',
      status: 'COMPLETED',
      completedAt: { not: null },
    },
    orderBy: { completedAt: 'desc' },
    take: 10,
    select: {
      id: true,
      completedAt: true,
      logs: true,
      ticket: {
        select: { ticketKey: true },
      },
    },
  });

  if (jobs.length === 0) {
    return {
      lastCleanDate: null,
      filesCleaned: 0,
      remainingIssues: 0,
      daysAgo: null,
      isOverdue: false,
      status: 'never',
      summary: 'No cleanup yet',
      history: [],
    };
  }

  const latest = jobs[0]!;
  const latestDate = latest.completedAt!;
  const latestLogs = parseCleanupLogs(latest.logs);
  const daysAgo = Math.floor((Date.now() - latestDate.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = daysAgo > 30;

  const history: LastCleanHistoryItem[] = jobs.map((job) => {
    const logs = parseCleanupLogs(job.logs);
    return {
      jobId: job.id,
      completedAt: job.completedAt!.toISOString(),
      filesCleaned: logs.filesCleaned,
      remainingIssues: logs.remainingIssues,
      summary: logs.summary || `Cleaned ${logs.filesCleaned} files`,
      ticketKey: job.ticket.ticketKey ?? null,
    };
  });

  return {
    lastCleanDate: latestDate.toISOString(),
    filesCleaned: latestLogs.filesCleaned,
    remainingIssues: latestLogs.remainingIssues,
    daysAgo,
    isOverdue,
    status: isOverdue ? 'overdue' : 'ok',
    summary: latestLogs.summary || `${daysAgo} days ago`,
    history,
  };
}
