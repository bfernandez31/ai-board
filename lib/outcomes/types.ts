/**
 * Shared types and constants for the outcome capture pipeline.
 */
import type { WorkflowType } from '@prisma/client';

export const RULE_SET_VERSION = 1 as const;
export const QUALITY_THRESHOLD_FRICTION_FREE = 75 as const;

export type PartialReason =
  | 'no_jobs'
  | 'no_branch_reference'
  | 'merge_not_found'
  | 'repository_unreachable'
  | 'fetch_failed_after_retry'
  | 'diff_truncated';

export interface DerivedOutcome {
  ticketId: number;
  projectId: number;
  workflowType: WorkflowType;
  shippedAt: Date;
  ruleSetVersion: typeof RULE_SET_VERSION;

  totalCostUsd: number | null;
  totalDurationMs: number | null;
  totalInputTokens: number | null;
  totalOutputTokens: number | null;
  totalThinkingTokens: number | null;
  totalCacheReadTokens: number | null;
  totalCacheCreationTokens: number | null;
  toolsUsed: string[];

  pipelineJobCount: number;
  frictionJobCount: number;
  totalJobCount: number;
  jobCountByPrefix: Record<string, number>;

  qualityScore: number | null;

  filesTouched: string[];
  linesAdded: number | null;
  linesRemoved: number | null;
  testCodeRatio: number | null;

  domains: string[];
  domainFileCounts: Record<string, number>;

  touchedDbSchema: boolean;
  touchedTests: boolean;
  touchedCi: boolean;

  frictionFree: boolean;

  partial: boolean;
  partialReason: PartialReason | null;
}

export interface ChangeShape {
  filesTouched: string[];
  linesAdded: number;
  linesRemoved: number;
  testCodeRatio: number;
  domains: string[];
  domainFileCounts: Record<string, number>;
}

export interface CommitFile {
  filename: string;
  additions: number;
  deletions: number;
  status?: string;
}
