import { useCallback, useEffect, useState } from 'react';
import { Job } from '@prisma/client';
import { TicketWithVersion } from '@/lib/types';
import type { DualJobState } from '@/lib/types/job-types';
import {
  createSnapshotJob,
  mergePolledIntoExistingJob,
  mergePolledJobsIntoSnapshots,
  pruneSnapshotsByTicketIds,
  replaceTicketJobSnapshot,
} from '@/lib/utils/job-snapshots';
import { getAIBoardJob, getDeployJob, getWorkflowJob } from '@/lib/utils/job-filtering';
import { useJobPolling } from '@/app/lib/hooks/useJobPolling';
import { useTicketJobs } from '@/app/lib/hooks/queries/useTicketJobs';
import { toBoardSnapshotJobs } from '../utils';

interface UseJobSnapshotsArgs {
  projectId: number;
  initialJobs: Map<number, Job[]>;
  allTickets: TicketWithVersion[];
  selectedTicketId: number | null;
  isModalOpen: boolean;
}

/**
 * Job snapshot store + dual-job-state derivation.
 *
 * Snapshots are the board's live source of truth: server-fetched initial jobs
 * absorb polling updates in place and preserve terminal workflow state even
 * after /jobs/status drops it. Selected-ticket telemetry rehydrates its slot
 * when the modal opens.
 */
export function useJobSnapshots({
  projectId,
  initialJobs,
  allTickets,
  selectedTicketId,
  isModalOpen,
}: UseJobSnapshotsArgs) {
  const [jobSnapshots, setJobSnapshots] = useState(() => new Map(initialJobs));

  // T030: Job polling integration for real-time job status updates
  const { jobs: polledJobs } = useJobPolling(projectId, 2000);

  // T007: Fetch ticket jobs with telemetry for modal Stats tab
  const { data: selectedTicketJobs = [] } = useTicketJobs(
    projectId,
    selectedTicketId,
    isModalOpen
  );

  useEffect(() => {
    setJobSnapshots((current) => mergePolledJobsIntoSnapshots(current, polledJobs, projectId));
  }, [polledJobs, projectId]);

  // Drop snapshots for tickets that disappeared (deleted, closed, paginated out)
  // so the in-memory map doesn't accumulate orphan entries across long sessions.
  useEffect(() => {
    const validIds = new Set(allTickets.map((ticket) => ticket.id));
    setJobSnapshots((current) => pruneSnapshotsByTicketIds(current, validIds));
  }, [allTickets]);

  useEffect(() => {
    if (!selectedTicketId || selectedTicketJobs.length === 0) {
      return;
    }

    const snapshotJobs = toBoardSnapshotJobs(
      selectedTicketJobs,
      selectedTicketId,
      projectId
    );

    setJobSnapshots((current) =>
      replaceTicketJobSnapshot(current, selectedTicketId, snapshotJobs)
    );
  }, [projectId, selectedTicketId, selectedTicketJobs]);

  // T030: Get dual job state for a ticket (workflow + AI-BOARD + deploy jobs)
  const getTicketJobs = useCallback(
    (ticketId: number): DualJobState => {
      const ticketSnapshotJobs = jobSnapshots.get(ticketId) || [];
      const ticketPolledJobs = polledJobs.filter(job => job.ticketId === ticketId);

      if (ticketSnapshotJobs.length === 0 && ticketPolledJobs.length === 0) {
        return { workflow: null, aiBoard: null, deployJob: null };
      }

      const activeJobs: Job[] = ticketPolledJobs.map(polledJob => {
        const matchingSnapshotJob = ticketSnapshotJobs.find(j => j.id === polledJob.id);
        return matchingSnapshotJob
          ? mergePolledIntoExistingJob(matchingSnapshotJob, polledJob)
          : createSnapshotJob(polledJob, projectId);
      });

      const polledIds = new Set(ticketPolledJobs.map(j => j.id));
      const historicalJobs = ticketSnapshotJobs.filter(j => !polledIds.has(j.id));
      const fullJobs = [...activeJobs, ...historicalJobs];

      const ticket = allTickets.find(t => t.id === ticketId);

      return {
        workflow: ticket ? getWorkflowJob(fullJobs, ticket.stage) : null,
        aiBoard: ticket ? getAIBoardJob(fullJobs, ticket.stage) : null,
        deployJob: getDeployJob(fullJobs),
      };
    },
    [polledJobs, jobSnapshots, projectId, allTickets]
  );

  // Merge initial and polled jobs for a ticket (used by trash/close zone eligibility)
  const getMergedTicketJobs = useCallback((ticketId: number) => {
    const initial = initialJobs.get(ticketId) || [];
    const polled = polledJobs.filter(job => job.ticketId === ticketId);
    const jobMap = new Map(initial.map(j => [j.id, j]));
    polled.forEach(pj => {
      const existing = jobMap.get(pj.id);
      jobMap.set(
        pj.id,
        existing
          ? mergePolledIntoExistingJob(existing, pj)
          : createSnapshotJob(pj, projectId),
      );
    });
    return Array.from(jobMap.values());
  }, [initialJobs, polledJobs, projectId]);

  return {
    jobSnapshots,
    polledJobs,
    selectedTicketJobs,
    getTicketJobs,
    getMergedTicketJobs,
  };
}
