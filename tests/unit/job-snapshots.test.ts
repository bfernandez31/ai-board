import { describe, expect, it } from 'vitest';
import type { Job } from '@prisma/client';
import {
  mergePolledJobsIntoSnapshots,
  pruneSnapshotsByTicketIds,
  replaceTicketJobSnapshot,
} from '@/lib/utils/job-snapshots';

function createSnapshotJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 1,
    ticketId: 10,
    projectId: 1,
    command: 'specify',
    status: 'RUNNING',
    workflowRunId: null,
    branch: 'feature/test',
    commitSha: null,
    logs: null,
    startedAt: new Date('2026-04-15T10:00:00.000Z'),
    completedAt: null,
    createdAt: new Date('2026-04-15T10:00:00.000Z'),
    updatedAt: new Date('2026-04-15T10:00:00.000Z'),
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
    ...overrides,
  };
}

describe('job snapshots', () => {
  it('preserves the latest terminal job state after polling stops returning the job', () => {
    const initialSnapshots = new Map<number, Job[]>([
      [10, [createSnapshotJob()]],
    ]);

    const afterFailure = mergePolledJobsIntoSnapshots(
      initialSnapshots,
      [
        {
          id: 1,
          ticketId: 10,
          command: 'specify',
          status: 'FAILED',
          updatedAt: '2026-04-15T10:05:00.000Z',
        },
      ],
      1
    );

    expect(afterFailure.get(10)?.[0]?.status).toBe('FAILED');
    expect(afterFailure.get(10)?.[0]?.completedAt?.toISOString()).toBe('2026-04-15T10:05:00.000Z');

    const afterEmptyPoll = mergePolledJobsIntoSnapshots(afterFailure, [], 1);

    expect(afterEmptyPoll.get(10)?.[0]?.status).toBe('FAILED');
    expect(afterEmptyPoll.get(10)?.[0]?.command).toBe('specify');
  });

  it('hydrates a brand-new polled job into the snapshot map', () => {
    const snapshots = mergePolledJobsIntoSnapshots(
      new Map(),
      [
        {
          id: 44,
          ticketId: 22,
          command: 'verify',
          status: 'PENDING',
          updatedAt: '2026-04-15T11:00:00.000Z',
        },
      ],
      3
    );

    expect(snapshots.get(22)).toHaveLength(1);
    expect(snapshots.get(22)?.[0]).toMatchObject({
      id: 44,
      ticketId: 22,
      projectId: 3,
      command: 'verify',
      status: 'PENDING',
    });
  });

  it('drops snapshots for tickets that no longer exist', () => {
    const snapshots = new Map<number, Job[]>([
      [10, [createSnapshotJob({ ticketId: 10 })]],
      [11, [createSnapshotJob({ id: 2, ticketId: 11 })]],
      [12, [createSnapshotJob({ id: 3, ticketId: 12 })]],
    ]);

    const pruned = pruneSnapshotsByTicketIds(snapshots, new Set([10, 12]));

    expect(pruned.size).toBe(2);
    expect(pruned.has(10)).toBe(true);
    expect(pruned.has(11)).toBe(false);
    expect(pruned.has(12)).toBe(true);
  });

  it('returns the same Map reference when nothing needs pruning (referential equality)', () => {
    const snapshots = new Map<number, Job[]>([
      [10, [createSnapshotJob({ ticketId: 10 })]],
    ]);

    const result = pruneSnapshotsByTicketIds(snapshots, new Set([10]));

    expect(result).toBe(snapshots);
  });

  it('replaces a stale ticket snapshot with freshly fetched full jobs', () => {
    const staleSnapshots = new Map<number, Job[]>([
      [10, [createSnapshotJob({ status: 'RUNNING', qualityScore: null })]],
    ]);

    const refreshedJobs = [
      createSnapshotJob({
        status: 'COMPLETED',
        completedAt: new Date('2026-04-15T10:06:00.000Z'),
        updatedAt: new Date('2026-04-15T10:06:00.000Z'),
        qualityScore: 91,
      }),
    ];

    const refreshedSnapshots = replaceTicketJobSnapshot(staleSnapshots, 10, refreshedJobs);

    expect(refreshedSnapshots.get(10)?.[0]?.status).toBe('COMPLETED');
    expect(refreshedSnapshots.get(10)?.[0]?.qualityScore).toBe(91);
  });
});
