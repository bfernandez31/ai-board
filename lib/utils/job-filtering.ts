import type { Job } from '@prisma/client';
import type { Stage } from '@/lib/validations/ticket';
import { matchesStage } from './stage-matcher';

/**
 * getWorkflowJob Function
 *
 * Filters and returns the most recent workflow job for a ticket.
 * Workflow jobs are those where command does NOT start with 'comment-'.
 *
 * @param jobs - Array of Job objects associated with a ticket
 * @param currentStage - Current ticket stage (used to filter out jobs for INBOX, VERIFY, and SHIP stages)
 * @returns Job | null - Most recent workflow job sorted by startedAt DESC, or null if none exist
 *
 * Filtering Rules:
 * - Return null if stage is INBOX, VERIFY, or SHIP (no workflow jobs in these stages)
 * - Exclude jobs where command starts with 'comment-' (AI-BOARD jobs)
 * - Sort remaining jobs by startedAt DESC (most recent first)
 * - Return first job or null if array is empty
 *
 * Examples:
 * - Workflow commands: specify, plan, implement, quick-impl
 * - AI-BOARD commands (excluded): comment-specify, comment-plan, comment-build, comment-verify
 */
export function getWorkflowJob(jobs: Job[], currentStage: Stage): Job | null {
  // INBOX, VERIFY, and SHIP stages never have workflow jobs
  if (currentStage === 'INBOX' || currentStage === 'VERIFY' || currentStage === 'SHIP') {
    return null;
  }

  const workflowJobs = jobs
    .filter((job) => !job.command.startsWith('comment-'))
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

  return workflowJobs[0] || null;
}

/**
 * T021: getAIBoardJob - AI-BOARD job filtering with stage matching
 *
 * Filters and returns the most recent AI-BOARD job for a ticket that matches the current stage.
 * AI-BOARD jobs are those where command starts with 'comment-' and the suffix matches the stage.
 *
 * @param jobs - Array of Job objects associated with a ticket
 * @param currentStage - Current ticket stage (SPECIFY, PLAN, BUILD, VERIFY)
 * @returns Job | null - Most recent AI-BOARD job that matches the stage, or null if none match
 *
 * Filtering Rules:
 * - Include only jobs where command starts with 'comment-' (AI-BOARD jobs)
 * - Filter by stage match using matchesStage() (case-insensitive)
 * - Sort remaining jobs by startedAt DESC (most recent first)
 * - Return first job or null if array is empty
 *
 * Stage Matching Examples:
 * - "comment-specify" visible only in SPECIFY stage
 * - "comment-plan" visible only in PLAN stage
 * - "comment-build" visible only in BUILD stage
 * - "comment-verify" visible only in VERIFY stage
 *
 * @example
 * // Ticket in SPECIFY stage with multiple jobs
 * const jobs = [
 *   { command: 'specify', status: 'COMPLETED', startedAt: new Date('2024-01-01') },
 *   { command: 'comment-specify', status: 'RUNNING', startedAt: new Date('2024-01-02') },
 *   { command: 'comment-plan', status: 'COMPLETED', startedAt: new Date('2024-01-03') }
 * ];
 * getAIBoardJob(jobs, 'SPECIFY') // => { command: 'comment-specify', ... }
 */
export function getAIBoardJob(jobs: Job[], currentStage: Stage): Job | null {
  const aiBoardJobs = jobs
    .filter((job) => job.command.startsWith('comment-'))
    .filter((job) => matchesStage(job.command, currentStage))
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

  return aiBoardJobs[0] || null;
}
