/**
 * Type definitions for the ticket-outcome capture pipeline.
 */

export const FRICTION_FREE_QUALITY_THRESHOLD = 80;

/**
 * Subset of the project `config` blob the outcome pipeline reads.
 *
 * Defined here (rather than imported from validations) so the outcome modules
 * stay decoupled from the full config shape — they only need language,
 * services, and testing-framework hints to drive semantic-tag inference.
 */
export interface ProjectConfigLike {
  project?: { language?: string | null; framework?: string | null };
  services?: Array<{ type?: string }>;
  testing?: { framework?: string; e2e?: boolean; e2e_framework?: string };
}

/** A single file change extracted from a commit/PR diff. */
export interface FileChange {
  path: string;
  additions: number;
  deletions: number;
  status?: string;
}

/** Aggregated diff signals for a ticket's commit range. */
export interface DiffStats {
  files: FileChange[];
  totalAdditions: number;
  totalDeletions: number;
}

/** Job-level signals computed from a ticket's job history. */
export interface JobSignals {
  totalCostUsd: number;
  totalDurationMs: number;
  pipelineJobCount: number;
  frictionJobCount: number;
  finalQualityScore: number | null;
}

/** Full computed outcome ready for persistence. */
export interface ComputedOutcome {
  totalCostUsd: number;
  totalDurationMs: number;
  pipelineJobCount: number;
  frictionJobCount: number;
  finalQualityScore: number | null;
  filesTouched: number | null;
  linesAdded: number | null;
  linesRemoved: number | null;
  codeFilesChanged: number | null;
  testFilesChanged: number | null;
  structuralDomains: string[];
  semanticTags: string[];
  frictionFree: boolean;
  hasCommitData: boolean;
}
