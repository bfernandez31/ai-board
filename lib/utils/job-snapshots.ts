import type { Job } from '@prisma/client';
import { isTerminalStatus, type JobStatusDto } from '@/app/lib/schemas/job-polling';

function datesEqual(left: Date | null, right: Date | null): boolean {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.getTime() === right.getTime();
}

export function createSnapshotJob(polledJob: JobStatusDto, projectId: number): Job {
  const updatedAt = new Date(polledJob.updatedAt);

  return {
    id: polledJob.id,
    ticketId: polledJob.ticketId,
    projectId,
    command: polledJob.command,
    status: polledJob.status,
    workflowRunId: null,
    branch: null,
    commitSha: null,
    logs: null,
    startedAt: updatedAt,
    completedAt: isTerminalStatus(polledJob.status) ? updatedAt : null,
    createdAt: updatedAt,
    updatedAt,
    inputTokens: null,
    outputTokens: null,
    cacheReadTokens: null,
    cacheCreationTokens: null,
    costUsd: null,
    durationMs: null,
    model: null,
    thinkingTokens: null,
    toolsUsed: [],
    qualityScore: null,
    qualityScoreDetails: null,
    layerDecomposition: null,
    peakContextTokens: null,
    avgContextTokens: null,
    turnCount: null,
    pluginVersion: null,
    agentCliVersion: null,
    tokenSavingOutcome: null,
  };
}

/**
 * Merge a polled status update into an existing snapshot job, preserving
 * snapshot-only fields (telemetry, branch, startedAt) while refreshing the
 * status, command, and timestamps from the live polling response.
 */
export function mergePolledIntoExistingJob(existing: Job, polledJob: JobStatusDto): Job {
  const updatedAt = new Date(polledJob.updatedAt);

  return {
    ...existing,
    status: polledJob.status,
    command: polledJob.command,
    updatedAt,
    completedAt: isTerminalStatus(polledJob.status) ? updatedAt : null,
  };
}

export function mergePolledJobsIntoSnapshots(
  snapshotMap: Map<number, Job[]>,
  polledJobs: JobStatusDto[],
  projectId: number
): Map<number, Job[]> {
  if (polledJobs.length === 0) {
    return snapshotMap;
  }

  let changed = false;
  const nextSnapshots = new Map(snapshotMap);

  for (const polledJob of polledJobs) {
    const currentJobs = nextSnapshots.get(polledJob.ticketId) ?? [];
    const currentIndex = currentJobs.findIndex((job) => job.id === polledJob.id);
    const nextUpdatedAt = new Date(polledJob.updatedAt);
    const nextCompletedAt = isTerminalStatus(polledJob.status) ? nextUpdatedAt : null;

    if (currentIndex === -1) {
      nextSnapshots.set(polledJob.ticketId, [
        createSnapshotJob(polledJob, projectId),
        ...currentJobs,
      ]);
      changed = true;
      continue;
    }

    const currentJob = currentJobs[currentIndex];
    if (!currentJob) {
      continue;
    }
    const shouldUpdate =
      currentJob.status !== polledJob.status ||
      currentJob.command !== polledJob.command ||
      currentJob.updatedAt.getTime() !== nextUpdatedAt.getTime() ||
      !datesEqual(currentJob.completedAt, nextCompletedAt);

    if (!shouldUpdate) {
      continue;
    }

    const nextJobs = [...currentJobs];
    nextJobs[currentIndex] = mergePolledIntoExistingJob(currentJob, polledJob);

    nextSnapshots.set(polledJob.ticketId, nextJobs);
    changed = true;
  }

  return changed ? nextSnapshots : snapshotMap;
}

/**
 * Drop snapshot entries whose ticket no longer appears in the active ticket list.
 * Prevents unbounded memory growth across long sessions where tickets are
 * deleted or paginate out of the board.
 */
export function pruneSnapshotsByTicketIds(
  snapshotMap: Map<number, Job[]>,
  validTicketIds: Set<number>
): Map<number, Job[]> {
  let changed = false;
  const nextSnapshots = new Map(snapshotMap);

  for (const ticketId of snapshotMap.keys()) {
    if (!validTicketIds.has(ticketId)) {
      nextSnapshots.delete(ticketId);
      changed = true;
    }
  }

  return changed ? nextSnapshots : snapshotMap;
}

export function replaceTicketJobSnapshot(
  snapshotMap: Map<number, Job[]>,
  ticketId: number,
  jobs: Job[]
): Map<number, Job[]> {
  const currentJobs = snapshotMap.get(ticketId) ?? [];

  if (
    currentJobs.length === jobs.length &&
    currentJobs.every((job, index) => {
      const nextJob = jobs[index];

      return (
        nextJob &&
        job.id === nextJob.id &&
        job.status === nextJob.status &&
        job.command === nextJob.command &&
        job.startedAt.getTime() === nextJob.startedAt.getTime() &&
        datesEqual(job.completedAt, nextJob.completedAt) &&
        job.qualityScore === nextJob.qualityScore
      );
    })
  ) {
    return snapshotMap;
  }

  const nextSnapshots = new Map(snapshotMap);
  nextSnapshots.set(ticketId, jobs);
  return nextSnapshots;
}
