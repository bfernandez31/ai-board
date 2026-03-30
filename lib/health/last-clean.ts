import { prisma } from '@/lib/db/client';

export interface LastCleanHistoryEntry {
  jobId: number;
  completedAt: string;
  filesCleaned: number | null;
  remainingIssues: number | null;
  summary: string | null;
}

export interface LastCleanDetails {
  lastCleanDate: string | null;
  stalenessStatus: 'ok' | 'warning' | 'alert' | null;
  daysSinceClean: number | null;
  filesCleaned: number | null;
  remainingIssues: number | null;
  summary: string | null;
  history: LastCleanHistoryEntry[];
}

/**
 * Compute staleness status from elapsed days since last cleanup.
 * <30 days = 'ok', 30-60 days = 'warning', >60 days = 'alert', no cleanup = null
 */
export function computeStalenessStatus(
  daysSinceClean: number | null,
): 'ok' | 'warning' | 'alert' | null {
  if (daysSinceClean === null) return null;
  if (daysSinceClean < 30) return 'ok';
  if (daysSinceClean <= 60) return 'warning';
  return 'alert';
}

/**
 * Parse structured cleanup data from a job output string.
 * Returns null fields when output doesn't contain structured data.
 */
export function parseCleanupOutput(output: string | null): {
  filesCleaned: number | null;
  remainingIssues: number | null;
  summary: string | null;
} {
  if (!output) return { filesCleaned: null, remainingIssues: null, summary: null };

  try {
    const parsed = JSON.parse(output);
    return {
      filesCleaned: typeof parsed.filesCleaned === 'number' ? parsed.filesCleaned : null,
      remainingIssues: typeof parsed.remainingIssues === 'number' ? parsed.remainingIssues : null,
      summary: typeof parsed.summary === 'string' ? parsed.summary : null,
    };
  } catch {
    // Not JSON — return nulls gracefully
    return { filesCleaned: null, remainingIssues: null, summary: null };
  }
}

/**
 * Get Last Clean data for a project.
 * Queries COMPLETED cleanup jobs ordered by completedAt DESC, limit 20.
 */
export async function getLastCleanData(projectId: number): Promise<LastCleanDetails> {
  const cleanupJobs = await prisma.job.findMany({
    where: {
      ticket: { projectId },
      command: 'clean',
      status: 'COMPLETED',
    },
    orderBy: { completedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      completedAt: true,
      logs: true,
    },
  });

  if (cleanupJobs.length === 0) {
    return {
      lastCleanDate: null,
      stalenessStatus: null,
      daysSinceClean: null,
      filesCleaned: null,
      remainingIssues: null,
      summary: null,
      history: [],
    };
  }

  const latest = cleanupJobs[0]!;
  const lastCleanDate = latest.completedAt!;
  const daysSinceClean = Math.floor(
    (Date.now() - lastCleanDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const stalenessStatus = computeStalenessStatus(daysSinceClean);
  const latestOutput = parseCleanupOutput(latest.logs);

  const history: LastCleanHistoryEntry[] = cleanupJobs.map((job) => {
    const parsed = parseCleanupOutput(job.logs);
    return {
      jobId: job.id,
      completedAt: job.completedAt!.toISOString(),
      filesCleaned: parsed.filesCleaned,
      remainingIssues: parsed.remainingIssues,
      summary: parsed.summary,
    };
  });

  return {
    lastCleanDate: lastCleanDate.toISOString(),
    stalenessStatus,
    daysSinceClean,
    filesCleaned: latestOutput.filesCleaned,
    remainingIssues: latestOutput.remainingIssues,
    summary: latestOutput.summary,
    history,
  };
}
