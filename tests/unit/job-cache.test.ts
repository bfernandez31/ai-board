import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { JobStatusDto } from '@/app/lib/schemas/job-polling';
import { seedPendingJobIntoStatusCache } from '@/lib/utils/job-cache';

function makeJob(overrides: Partial<JobStatusDto> = {}): JobStatusDto {
  return {
    id: 77,
    ticketId: 12,
    status: 'PENDING',
    command: 'specify',
    updatedAt: '2026-04-15T10:00:00.000Z',
    ...overrides,
  };
}

describe('seedPendingJobIntoStatusCache', () => {
  it('hydrates an empty cache with the seeded job', () => {
    const queryClient = new QueryClient();

    seedPendingJobIntoStatusCache(queryClient, 1, makeJob());

    expect(queryClient.getQueryData(queryKeys.projects.jobsStatus(1))).toEqual([makeJob()]);
  });

  it('replaces a previous entry with the same id rather than duplicating it', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.projects.jobsStatus(1), [
      makeJob({ status: 'PENDING' }),
    ]);

    seedPendingJobIntoStatusCache(
      queryClient,
      1,
      makeJob({ status: 'RUNNING', updatedAt: '2026-04-15T10:00:05.000Z' })
    );

    const cache = queryClient.getQueryData<JobStatusDto[]>(
      queryKeys.projects.jobsStatus(1)
    );

    expect(cache).toHaveLength(1);
    expect(cache?.[0]?.status).toBe('RUNNING');
  });

  it('preserves other jobs in the cache while inserting a new one', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.projects.jobsStatus(1), [
      makeJob({ id: 1, ticketId: 5 }),
    ]);

    seedPendingJobIntoStatusCache(queryClient, 1, makeJob({ id: 2, ticketId: 6 }));

    const cache = queryClient.getQueryData<JobStatusDto[]>(
      queryKeys.projects.jobsStatus(1)
    );

    expect(cache).toHaveLength(2);
    expect(cache?.map((job) => job.id).sort()).toEqual([1, 2]);
  });
});
