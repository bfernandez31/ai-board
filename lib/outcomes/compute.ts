/**
 * Compose a ComputedOutcome from a ticket's jobs and (optional) diff stats.
 *
 * Pure logic — no DB or network. The caller fetches inputs, this module
 * decides how to combine them into the final shape persisted to TicketOutcome.
 */

import type { ComputedOutcome, DiffStats, JobSignals } from './types';
import { FRICTION_FREE_QUALITY_THRESHOLD } from './types';
import { computeSemanticTags, extractStructuralDomains } from './domain';

interface ProjectConfigLike {
  project?: { language?: string | null; framework?: string | null };
  services?: Array<{ type?: string }>;
  testing?: { framework?: string; e2e?: boolean; e2e_framework?: string };
}

export interface BuildOutcomeInput {
  jobSignals: JobSignals;
  diff: DiffStats | null;
  projectConfig: ProjectConfigLike | null | undefined;
}

/**
 * Combine job signals + diff + project config into a persistable outcome.
 *
 * `frictionFree` is true only when:
 *   - no friction jobs were run (no iterate, no comment-driven re-runs), AND
 *   - the final quality score (if present) is above the calibrated threshold.
 *
 * A ticket with NO quality score (e.g. quick-impl tickets that bypass verify)
 * still qualifies as friction-free as long as no friction jobs ran — quality
 * gating only kicks in when we have a measurement to gate on.
 */
export function buildOutcome(input: BuildOutcomeInput): ComputedOutcome {
  const { jobSignals, diff, projectConfig } = input;

  const hasCommitData = diff !== null;
  let filesTouched: number | null = null;
  let linesAdded: number | null = null;
  let linesRemoved: number | null = null;
  let codeFilesChanged: number | null = null;
  let testFilesChanged: number | null = null;
  let structuralDomains: string[] = [];
  let semanticTags: string[] = [];

  if (diff) {
    filesTouched = diff.files.length;
    linesAdded = diff.totalAdditions;
    linesRemoved = diff.totalDeletions;
    structuralDomains = extractStructuralDomains(diff.files);
    const tagResult = computeSemanticTags(diff.files, projectConfig);
    semanticTags = tagResult.tags;
    codeFilesChanged = tagResult.codeFilesChanged;
    testFilesChanged = tagResult.testFilesChanged;
  }

  const qualityScoreOk =
    jobSignals.finalQualityScore === null ||
    jobSignals.finalQualityScore >= FRICTION_FREE_QUALITY_THRESHOLD;
  const frictionFree = jobSignals.frictionJobCount === 0 && qualityScoreOk;

  return {
    totalCostUsd: jobSignals.totalCostUsd,
    totalDurationMs: jobSignals.totalDurationMs,
    pipelineJobCount: jobSignals.pipelineJobCount,
    frictionJobCount: jobSignals.frictionJobCount,
    finalQualityScore: jobSignals.finalQualityScore,
    filesTouched,
    linesAdded,
    linesRemoved,
    codeFilesChanged,
    testFilesChanged,
    structuralDomains,
    semanticTags,
    frictionFree,
    hasCommitData,
  };
}
