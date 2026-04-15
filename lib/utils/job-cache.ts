import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { JobStatusDto } from '@/app/lib/schemas/job-polling';

/**
 * Optimistically inject a freshly-created job into the polling cache so the
 * board reflects the new state immediately, without waiting for the next
 * polling tick. The next poll cycle will reconcile the optimistic entry with
 * the server's authoritative response.
 *
 * Used after mutations that create jobs server-side (stage transitions,
 * preview deployments, etc.) — anywhere we know a job ID right after a
 * mutation succeeds and want to surface it instantly on the board.
 */
export function seedPendingJobIntoStatusCache(
  queryClient: QueryClient,
  projectId: number,
  job: JobStatusDto
): void {
  queryClient.setQueryData<JobStatusDto[]>(
    queryKeys.projects.jobsStatus(projectId),
    (current) => {
      const existing = current ?? [];
      const others = existing.filter((entry) => entry.id !== job.id);
      return [job, ...others];
    }
  );
}
