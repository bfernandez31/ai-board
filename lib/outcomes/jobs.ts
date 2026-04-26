/**
 * Job-level signal extraction for ticket outcomes.
 *
 * Aggregates cost/duration across all relevant jobs and classifies each as
 * either pipeline (standard delivery) or friction (iterate runs, comment-driven
 * re-runs). Infrastructure jobs (deploy-preview, rollback-reset, health-scan)
 * are intentionally excluded from both buckets — they are not delivery work.
 */

import type { Job, JobStatus } from '@prisma/client';
import type { JobSignals } from './types';

const PIPELINE_COMMANDS: ReadonlySet<string> = new Set([
  'specify',
  'plan',
  'implement',
  'quick-impl',
  'verify',
  'ship',
]);

const INFRASTRUCTURE_COMMANDS: ReadonlySet<string> = new Set([
  'deploy-preview',
  'rollback-reset',
  'health-scan',
]);

export type JobBucket = 'pipeline' | 'friction' | 'infrastructure';

export function classifyJob(command: string): JobBucket {
  if (command.startsWith('comment-')) return 'friction';
  if (command === 'iterate') return 'friction';
  if (PIPELINE_COMMANDS.has(command)) return 'pipeline';
  if (INFRASTRUCTURE_COMMANDS.has(command)) return 'infrastructure';
  // Unknown commands: treat as infrastructure so we don't count them as either
  // pipeline or friction. They'll still contribute their cost via the totals
  // pass below.
  return 'infrastructure';
}

type JobLike = Pick<Job, 'command' | 'costUsd' | 'durationMs' | 'status' | 'qualityScore'>;

/**
 * Pick the final quality score from a ticket's job history.
 *
 * Strategy: take the qualityScore of the most recent COMPLETED verify-class job.
 * `iterate` runs are quality re-evaluations of the verify stage, so they count
 * for this purpose. Jobs are expected sorted oldest→newest.
 */
function pickFinalQualityScore(jobs: JobLike[]): number | null {
  for (let i = jobs.length - 1; i >= 0; i--) {
    const job = jobs[i];
    if (!job) continue;
    if (job.status !== 'COMPLETED') continue;
    if (job.command !== 'verify' && job.command !== 'iterate') continue;
    if (typeof job.qualityScore === 'number') return job.qualityScore;
  }
  return null;
}

export interface ComputeJobSignalsInput {
  jobs: JobLike[];
}

/**
 * Compute aggregated job-level signals for a ticket.
 *
 * Cost and duration aggregate across ALL jobs (pipeline + friction +
 * infrastructure) — that's the actual resource consumption tied to the ticket.
 * Pipeline/friction counts only count the delivery-work classification.
 */
export function computeJobSignals(input: ComputeJobSignalsInput): JobSignals {
  let totalCostUsd = 0;
  let totalDurationMs = 0;
  let pipelineJobCount = 0;
  let frictionJobCount = 0;

  for (const job of input.jobs) {
    if (typeof job.costUsd === 'number') totalCostUsd += job.costUsd;
    if (typeof job.durationMs === 'number') totalDurationMs += job.durationMs;

    const bucket = classifyJob(job.command);
    if (bucket === 'pipeline') pipelineJobCount += 1;
    else if (bucket === 'friction') frictionJobCount += 1;
  }

  return {
    totalCostUsd,
    totalDurationMs,
    pipelineJobCount,
    frictionJobCount,
    finalQualityScore: pickFinalQualityScore(input.jobs),
  };
}

export type { JobStatus };
