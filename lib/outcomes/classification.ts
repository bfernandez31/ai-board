/**
 * Pipeline-vs-friction job classification.
 *
 * A "friction" job is one whose command starts with `iterate` (e.g., `iterate`, `iterate-XXX`)
 * or with `comment-` (e.g., `comment-build`, `comment-specify`). All other commands are
 * classified as pipeline (the normal forward-flow commands like specify, plan, implement, verify).
 *
 * The classification is pinned to RULE_SET_VERSION; any change to the rules requires a bump.
 */

import { RULE_SET_VERSION } from './types';

export { RULE_SET_VERSION };

export type JobClassification = 'pipeline' | 'friction';

export function classifyJobByCommand(command: string | null | undefined): JobClassification {
  if (!command) return 'pipeline';
  if (command === 'iterate' || command.startsWith('iterate-')) return 'friction';
  if (command.startsWith('comment-')) return 'friction';
  return 'pipeline';
}

export interface JobLikeForClassification {
  command: string | null;
}

export interface JobCountAggregation {
  pipelineJobCount: number;
  frictionJobCount: number;
  totalJobCount: number;
  jobCountByPrefix: Record<string, number>;
}

/**
 * Aggregate job counts by classification and per-command prefix.
 *
 * The per-command map keys on the raw command string (which is either the literal
 * command for pipeline jobs or `iterate` / `comment-XXX` for friction jobs).
 */
export function aggregateJobCounts(jobs: JobLikeForClassification[]): JobCountAggregation {
  let pipelineJobCount = 0;
  let frictionJobCount = 0;
  const jobCountByPrefix: Record<string, number> = {};

  for (const job of jobs) {
    const cls = classifyJobByCommand(job.command);
    if (cls === 'friction') frictionJobCount++;
    else pipelineJobCount++;

    const key = job.command && job.command.length > 0 ? job.command : 'unknown';
    jobCountByPrefix[key] = (jobCountByPrefix[key] ?? 0) + 1;
  }

  return {
    pipelineJobCount,
    frictionJobCount,
    totalJobCount: pipelineJobCount + frictionJobCount,
    jobCountByPrefix,
  };
}
