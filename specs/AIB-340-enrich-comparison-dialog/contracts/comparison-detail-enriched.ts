/**
 * API Contract: Enriched Comparison Detail Response
 *
 * GET /api/projects/:projectId/tickets/:id/comparisons/:comparisonId
 *
 * This contract defines the enriched response shape for AIB-340.
 * Changes from existing contract are marked with [NEW] or [MODIFIED].
 */

import type { QualityScoreDetails, ScoreThreshold } from '@/lib/quality-score';

// ─── Enrichment Wrapper (existing) ──────────────────────────────────────

type ComparisonEnrichmentState = 'available' | 'pending' | 'unavailable';

interface ComparisonEnrichmentValue<T> {
  state: ComparisonEnrichmentState;
  value: T | null;
}

// ─── Telemetry Enrichment [MODIFIED] ────────────────────────────────────

interface ComparisonTelemetryEnrichment {
  /** Sum of inputTokens across all COMPLETED jobs */
  inputTokens: ComparisonEnrichmentValue<number>;

  /** Sum of outputTokens across all COMPLETED jobs */
  outputTokens: ComparisonEnrichmentValue<number>;

  /** [NEW] Sum of (inputTokens + outputTokens) across all COMPLETED jobs */
  totalTokens: ComparisonEnrichmentValue<number>;

  /** Sum of durationMs across all COMPLETED jobs */
  durationMs: ComparisonEnrichmentValue<number>;

  /** Sum of costUsd across all COMPLETED jobs */
  costUsd: ComparisonEnrichmentValue<number>;

  /** [NEW] Count of COMPLETED jobs for this ticket */
  jobCount: ComparisonEnrichmentValue<number>;

  /** [NEW] Model from the job with highest total token consumption */
  primaryModel: ComparisonEnrichmentValue<string>;
}

// ─── Participant Detail [MODIFIED] ──────────────────────────────────────

interface ComparisonParticipantDetail {
  ticketId: number;
  ticketKey: string;
  title: string;
  stage: string;
  workflowType: 'FULL' | 'QUICK' | 'CLEAN';
  agent: string | null;
  rank: number;
  score: number;
  rankRationale: string;

  /** Quality score (0-100) with enrichment state */
  quality: ComparisonEnrichmentValue<number>;

  /** [NEW] Quality score breakdown with dimension details */
  qualityBreakdown: ComparisonEnrichmentValue<QualityScoreDetails>;

  /** [MODIFIED] Now aggregated across all COMPLETED jobs */
  telemetry: ComparisonTelemetryEnrichment;

  /** Code metrics snapshot (unchanged) */
  metrics: {
    linesAdded: number | null;
    linesRemoved: number | null;
    linesChanged: number | null;
    filesChanged: number | null;
    testFilesChanged: number | null;
    changedFiles: string[];
    bestValueFlags: Record<string, boolean>;
  };
}

// ─── Operational Metrics Best Value Flags [NEW] ─────────────────────────

/**
 * Best value flags for operational metrics.
 * Computed client-side from participant telemetry values.
 *
 * Key: metric name (e.g., 'totalTokens', 'costUsd', 'qualityScore')
 * Value: true if this participant has the best value for that metric
 *
 * Polarity:
 * - Lowest is best: totalTokens, inputTokens, outputTokens, durationMs, costUsd, jobCount
 * - Highest is best: qualityScore
 */
type OperationalMetricsBestValueFlags = Record<string, boolean>;

// ─── Full Response (unchanged structure, enriched participants) ─────────

interface ComparisonDetailResponse {
  id: number;
  generatedAt: string;
  sourceTicketId: number;
  sourceTicketKey: string;
  markdownPath: string;
  summary: string;
  overallRecommendation: string;
  keyDifferentiators: string[];
  winnerTicketId: number;
  winnerTicketKey: string;
  participants: ComparisonParticipantDetail[];
  decisionPoints: Array<{
    id: number;
    title: string;
    verdictTicketId: number | null;
    verdictSummary: string;
    rationale: string;
    displayOrder: number;
    participantApproaches: Array<{
      ticketId: number;
      ticketKey: string;
      summary: string;
    }>;
  }>;
  complianceRows: Array<{
    principleKey: string;
    principleName: string;
    displayOrder: number;
    assessments: Array<{
      participantTicketId: number;
      participantTicketKey: string;
      status: 'pass' | 'mixed' | 'fail';
      notes: string;
    }>;
  }>;
}

// ─── Example Response Fragments ─────────────────────────────────────────

/**
 * Example: Participant with full operational metrics
 *
 * {
 *   "ticketId": 42,
 *   "ticketKey": "AIB-42",
 *   "workflowType": "FULL",
 *   "agent": "CLAUDE",
 *   "quality": { "state": "available", "value": 87 },
 *   "qualityBreakdown": {
 *     "state": "available",
 *     "value": {
 *       "dimensions": [
 *         { "name": "Compliance", "agentId": "compliance", "score": 92, "weight": 0.4, "weightedScore": 36.8 },
 *         { "name": "Bug Detection", "agentId": "bug-detection", "score": 85, "weight": 0.3, "weightedScore": 25.5 },
 *         { "name": "Code Comments", "agentId": "code-comments", "score": 80, "weight": 0.2, "weightedScore": 16.0 },
 *         { "name": "Historical Context", "agentId": "historical-context", "score": 75, "weight": 0.1, "weightedScore": 7.5 },
 *         { "name": "Spec Sync", "agentId": "spec-sync", "score": 90, "weight": 0.0, "weightedScore": 0.0 }
 *       ],
 *       "threshold": "Good",
 *       "computedAt": "2026-03-24T12:00:00.000Z"
 *     }
 *   },
 *   "telemetry": {
 *     "inputTokens": { "state": "available", "value": 45000 },
 *     "outputTokens": { "state": "available", "value": 12000 },
 *     "totalTokens": { "state": "available", "value": 57000 },
 *     "durationMs": { "state": "available", "value": 185000 },
 *     "costUsd": { "state": "available", "value": 2.35 },
 *     "jobCount": { "state": "available", "value": 3 },
 *     "primaryModel": { "state": "available", "value": "claude-sonnet-4-6" }
 *   }
 * }
 *
 * Example: QUICK workflow participant (no quality breakdown)
 *
 * {
 *   "ticketId": 43,
 *   "ticketKey": "AIB-43",
 *   "workflowType": "QUICK",
 *   "agent": "CLAUDE",
 *   "quality": { "state": "unavailable", "value": null },
 *   "qualityBreakdown": { "state": "unavailable", "value": null },
 *   "telemetry": {
 *     "inputTokens": { "state": "available", "value": 8000 },
 *     "outputTokens": { "state": "available", "value": 3000 },
 *     "totalTokens": { "state": "available", "value": 11000 },
 *     "durationMs": { "state": "available", "value": 42000 },
 *     "costUsd": { "state": "available", "value": 0.45 },
 *     "jobCount": { "state": "available", "value": 1 },
 *     "primaryModel": { "state": "available", "value": "claude-sonnet-4-6" }
 *   }
 * }
 */

export type {
  ComparisonDetailResponse,
  ComparisonParticipantDetail,
  ComparisonTelemetryEnrichment,
  ComparisonEnrichmentValue,
  OperationalMetricsBestValueFlags,
};
