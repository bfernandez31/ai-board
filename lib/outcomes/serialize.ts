/**
 * Serialise a Prisma TicketOutcome row to the JSON shape declared in
 * contracts/outcome-api.md. Dates → ISO strings; JSON columns are returned as-is.
 */

import type { TicketOutcome } from '@prisma/client';

export interface SerializedOutcome {
  id: number;
  ticketId: number;
  projectId: number;
  workflowType: string;
  shippedAt: string;
  capturedAt: string;
  ruleSetVersion: number;
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
  partialReason: string | null;
  ticketKey?: string;
}

export function serializeOutcome(
  outcome: TicketOutcome,
  options?: { ticketKey?: string }
): SerializedOutcome {
  const result: SerializedOutcome = {
    id: outcome.id,
    ticketId: outcome.ticketId,
    projectId: outcome.projectId,
    workflowType: outcome.workflowType,
    shippedAt: outcome.shippedAt.toISOString(),
    capturedAt: outcome.capturedAt.toISOString(),
    ruleSetVersion: outcome.ruleSetVersion,
    totalCostUsd: outcome.totalCostUsd,
    totalDurationMs: outcome.totalDurationMs,
    totalInputTokens: outcome.totalInputTokens,
    totalOutputTokens: outcome.totalOutputTokens,
    totalThinkingTokens: outcome.totalThinkingTokens,
    totalCacheReadTokens: outcome.totalCacheReadTokens,
    totalCacheCreationTokens: outcome.totalCacheCreationTokens,
    toolsUsed: outcome.toolsUsed,
    pipelineJobCount: outcome.pipelineJobCount,
    frictionJobCount: outcome.frictionJobCount,
    totalJobCount: outcome.totalJobCount,
    jobCountByPrefix: (outcome.jobCountByPrefix ?? {}) as Record<string, number>,
    qualityScore: outcome.qualityScore,
    filesTouched: outcome.filesTouched,
    linesAdded: outcome.linesAdded,
    linesRemoved: outcome.linesRemoved,
    testCodeRatio: outcome.testCodeRatio,
    domains: outcome.domains,
    domainFileCounts: (outcome.domainFileCounts ?? {}) as Record<string, number>,
    touchedDbSchema: outcome.touchedDbSchema,
    touchedTests: outcome.touchedTests,
    touchedCi: outcome.touchedCi,
    frictionFree: outcome.frictionFree,
    partial: outcome.partial,
    partialReason: outcome.partialReason,
  };
  if (options?.ticketKey) {
    result.ticketKey = options.ticketKey;
  }
  return result;
}
