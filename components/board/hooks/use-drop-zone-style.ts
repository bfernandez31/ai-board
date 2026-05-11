import { useCallback } from 'react';
import { Job } from '@prisma/client';
import { Stage, isValidTransition } from '@/lib/stage-transitions';
import { TicketWithVersion } from '@/lib/types';
import {
  canRollbackBuildToPlan,
  canRollbackPlanToSpecify,
  canRollbackSpecifyToInbox,
  canRollbackToInbox,
  canRollbackToPlan,
  canRollbackVerifyToBuild,
} from '@/app/lib/workflows/rollback-validator';
import type { JobStatusDto } from '@/app/lib/schemas/job-polling';

interface UseDropZoneStyleArgs {
  isDragging: boolean;
  dragSource: Stage | null;
  draggedTicketHasJob: boolean;
  activeTicket: TicketWithVersion | null;
  initialJobs: Map<number, Job[]>;
  polledJobs: JobStatusDto[];
  validRollbackTargets: Stage[];
}

/**
 * Computes the Tailwind class string for a column's drop zone given the current
 * drag state. Encapsulates the rollback-eligibility checks, quick-impl branch,
 * verify-rollback branch, and the default valid/invalid transition styling.
 */
export function useDropZoneStyle({
  isDragging,
  dragSource,
  draggedTicketHasJob,
  activeTicket,
  initialJobs,
  polledJobs,
  validRollbackTargets,
}: UseDropZoneStyleArgs) {
  return useCallback(
    (stage: Stage): string => {
      if (!isDragging || !dragSource || !activeTicket) return '';

      // Find the most recent workflow job (polled takes precedence over initial).
      const getMostRecentWorkflowJob = () => {
        const ticketJobs = initialJobs.get(activeTicket.id) || [];
        const polledTicketJobs = polledJobs.filter(
          (job) => job.ticketId === activeTicket.id && !job.command.startsWith('comment-')
        );

        if (polledTicketJobs.length > 0) {
          const mostRecentPolled = polledTicketJobs.reduce((latest, current) =>
            new Date(current.updatedAt) > new Date(latest.updatedAt) ? current : latest
          );
          return {
            id: mostRecentPolled.id,
            status: mostRecentPolled.status,
            command: mostRecentPolled.command,
          };
        }

        const workflowJobs = ticketJobs.filter(
          (job) => job.command && !job.command.startsWith('comment-')
        );
        if (workflowJobs.length > 0 && workflowJobs[0]) {
          const firstJob = workflowJobs[0];
          return {
            id: firstJob.id,
            status: firstJob.status,
            command: firstJob.command,
          };
        }
        return null;
      };

      // AIB-512: Rollback mode for new transitions — highlight valid rollback targets
      if (validRollbackTargets.length > 0 && validRollbackTargets.includes(stage)) {
        const mostRecentWorkflowJob = getMostRecentWorkflowJob();
        let validation = { allowed: false };

        if (dragSource === Stage.SPECIFY && stage === Stage.INBOX) {
          validation = canRollbackSpecifyToInbox(dragSource, stage, activeTicket.workflowType, mostRecentWorkflowJob);
        } else if (dragSource === Stage.PLAN && stage === Stage.SPECIFY) {
          validation = canRollbackPlanToSpecify(dragSource, stage, activeTicket.workflowType, mostRecentWorkflowJob);
        } else if (dragSource === Stage.BUILD && stage === Stage.PLAN) {
          validation = canRollbackBuildToPlan(dragSource, stage, activeTicket.workflowType, mostRecentWorkflowJob);
        } else if (dragSource === Stage.VERIFY && stage === Stage.BUILD) {
          validation = canRollbackVerifyToBuild(dragSource, stage, activeTicket.workflowType, mostRecentWorkflowJob);
        }

        if (validation.allowed) {
          return 'border-4 border-dashed border-amber-500 bg-amber-500/10';
        }
        return 'opacity-50 cursor-not-allowed';
      }

      // Rollback mode: BUILD → INBOX (quick-impl only)
      if (dragSource === Stage.BUILD && stage === Stage.INBOX) {
        const validation = canRollbackToInbox(
          dragSource, stage, activeTicket.workflowType, getMostRecentWorkflowJob()
        );
        return validation.allowed
          ? 'border-4 border-dashed border-amber-500 bg-amber-500/10'
          : 'opacity-50 cursor-not-allowed';
      }

      // Rollback mode: VERIFY → PLAN (AIB-75, FULL workflows only)
      if (dragSource === Stage.VERIFY && stage === Stage.PLAN) {
        const validation = canRollbackToPlan(
          dragSource, stage, activeTicket.workflowType, getMostRecentWorkflowJob()
        );
        return validation.allowed
          ? 'border-4 border-dashed border-amber-500 bg-amber-500/10'
          : 'opacity-50 cursor-not-allowed';
      }

      if (draggedTicketHasJob) {
        return 'opacity-50 cursor-not-allowed';
      }

      // Quick-impl mode: Dragging from INBOX
      if (dragSource === Stage.INBOX) {
        if (stage === Stage.SPECIFY) {
          return 'border-4 border-dashed border-primary bg-primary/10';
        }
        if (stage === Stage.BUILD) {
          return 'border-4 border-dashed border-ctp-green bg-ctp-green/10';
        }
        return 'opacity-50 cursor-not-allowed';
      }

      // AIB-148: Close mode - Dragging from VERIFY to SHIP or CLOSED
      if (dragSource === Stage.VERIFY) {
        if (stage === Stage.SHIP) {
          return 'border-4 border-dashed border-ctp-green bg-ctp-green/10';
        }
        if (stage === Stage.CLOSED) {
          return 'border-4 border-dashed border-destructive bg-destructive/10';
        }
      }

      return isValidTransition(dragSource, stage)
        ? 'border-4 border-dashed border-primary bg-primary/10'
        : 'opacity-50 cursor-not-allowed';
    },
    [isDragging, dragSource, draggedTicketHasJob, activeTicket, initialJobs, polledJobs, validRollbackTargets]
  );
}
