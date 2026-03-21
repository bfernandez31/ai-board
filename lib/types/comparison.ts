/**
 * Ticket Comparison Types
 *
 * TypeScript interfaces for the ticket comparison feature (AIB-123).
 * These types define the data structures for parsing, analysis, and reporting.
 */

import type { Stage, WorkflowType } from '@prisma/client';
import type { QualityScoreDetails } from '@/lib/quality-score';

/**
 * TicketReference
 *
 * Parsed ticket key reference from comment text.
 * Extracted via regex pattern /#([A-Z0-9]{3,6}-\d+)/g
 */
export interface TicketReference {
  /** Raw ticket key (e.g., "AIB-124") */
  ticketKey: string;

  /** Start position in source text */
  startIndex: number;

  /** End position in source text */
  endIndex: number;
}

/**
 * ComparisonTarget
 *
 * Resolved ticket with metadata for comparison.
 */
export interface ComparisonTarget {
  /** Ticket database record subset */
  ticket: {
    id: number;
    ticketKey: string;
    title: string;
    branch: string | null;
    stage: Stage;
    workflowType: WorkflowType;
  };

  /** Resolution status */
  status: 'resolved' | 'branch_missing' | 'merge_analyzed' | 'unavailable';

  /** Commit SHA if resolved via merge */
  mergeCommitSha?: string;

  /** Spec content if available */
  specContent?: string;

  /** Plan content if available */
  planContent?: string;
}

/**
 * FeatureAlignmentScore
 *
 * Calculated similarity between compared tickets.
 * Weighted dimensions: requirements (40%), scenarios (30%), entities (20%), keywords (10%)
 */
export interface FeatureAlignmentScore {
  /** Overall alignment (0-100%) */
  overall: number;

  /** Breakdown by dimension */
  dimensions: {
    /** Functional requirements overlap (40% weight) */
    requirements: number;

    /** User scenario overlap (30% weight) */
    scenarios: number;

    /** Entity/data model overlap (20% weight) */
    entities: number;

    /** Keyword overlap (10% weight) */
    keywords: number;
  };

  /** Whether full comparison is warranted (>= 30%) */
  isAligned: boolean;

  /** Matching requirements (FR-XXX identifiers) */
  matchingRequirements: string[];

  /** Matching entity names */
  matchingEntities: string[];
}

/**
 * ConstitutionPrinciple
 *
 * Assessment of a single constitution principle.
 */
export interface ConstitutionPrinciple {
  /** Principle name (e.g., "TypeScript-First Development") */
  name: string;

  /** Section ID (e.g., "I", "II", "III") */
  section: string;

  /** Pass/fail status */
  passed: boolean;

  /** Specific findings or violations */
  notes: string;
}

/**
 * ConstitutionComplianceScore
 *
 * Compliance assessment against project constitution.
 */
export interface ConstitutionComplianceScore {
  /** Overall compliance (0-100%) */
  overall: number;

  /** Total principles evaluated */
  totalPrinciples: number;

  /** Principles passed */
  passedPrinciples: number;

  /** Per-principle assessment */
  principles: ConstitutionPrinciple[];
}

/**
 * TicketTelemetry
 *
 * Aggregated job telemetry for a ticket.
 */
export interface TicketTelemetry {
  /** Ticket identifier */
  ticketKey: string;

  /** Total input tokens across all jobs */
  inputTokens: number;

  /** Total output tokens across all jobs */
  outputTokens: number;

  /** Total cache read tokens */
  cacheReadTokens: number;

  /** Total cache creation tokens */
  cacheCreationTokens: number;

  /** Total cost in USD */
  costUsd: number;

  /** Total duration in milliseconds */
  durationMs: number;

  /** Primary model used */
  model: string | null;

  /** Unique tools used across jobs */
  toolsUsed: string[];

  /** Number of jobs */
  jobCount: number;

  /** Whether telemetry data is available */
  hasData: boolean;
}

/**
 * ImplementationMetrics
 *
 * Code change metrics for a ticket.
 */
export interface ImplementationMetrics {
  /** Ticket identifier */
  ticketKey: string;

  /** Total lines added */
  linesAdded: number;

  /** Total lines removed */
  linesRemoved: number;

  /** Net lines changed */
  linesChanged: number;

  /** Number of files changed */
  filesChanged: number;

  /** Changed file paths */
  changedFiles: string[];

  /** Test files changed */
  testFilesChanged: number;

  /** Estimated test coverage percentage (if available) */
  testCoverage?: number;

  /** Whether metrics are available */
  hasData: boolean;
}

/**
 * ComparisonReportMetadata
 *
 * Metadata for a comparison report.
 */
export interface ComparisonReportMetadata {
  /** Report generation timestamp */
  generatedAt: Date;

  /** Source ticket where comparison was triggered */
  sourceTicket: string;

  /** Compared ticket keys */
  comparedTickets: string[];

  /** Report file path */
  filePath: string;
}

/**
 * ComparisonReport
 *
 * Full comparison document structure.
 */
export interface ComparisonReport {
  /** Report metadata */
  metadata: ComparisonReportMetadata;

  /** Executive summary */
  summary: string;

  /** Feature alignment analysis */
  alignment: FeatureAlignmentScore;

  /** Per-ticket implementation metrics */
  implementation: Record<string, ImplementationMetrics>;

  /** Per-ticket constitution compliance */
  compliance: Record<string, ConstitutionComplianceScore>;

  /** Per-ticket telemetry/cost */
  telemetry: Record<string, TicketTelemetry>;

  /** AI-generated recommendation */
  recommendation: string;

  /** Warnings (e.g., low alignment, missing data) */
  warnings: string[];
}

export interface SerializedComparisonReportMetadata {
  /** Report generation timestamp */
  generatedAt: string;

  /** Source ticket where comparison was triggered */
  sourceTicket: string;

  /** Compared ticket keys */
  comparedTickets: string[];

  /** Report file path */
  filePath: string;
}

export interface SerializedComparisonReport
  extends Omit<ComparisonReport, 'metadata'> {
  /** JSON-safe report metadata */
  metadata: SerializedComparisonReportMetadata;
}

export interface ComparisonPersistenceRequest {
  compareRunKey: string;
  projectId: number;
  sourceTicketKey: string;
  participantTicketKeys: string[];
  markdownPath: string;
  report: ComparisonReport;
}

export interface SerializedComparisonPersistenceRequest
  extends Omit<ComparisonPersistenceRequest, 'report'> {
  report: SerializedComparisonReport;
}

export interface ComparisonPersistenceResponse {
  comparisonId: number;
  compareRunKey: string;
  status: 'created' | 'duplicate';
}

/**
 * SpecSections
 *
 * Extracted sections from a specification document.
 * Used for feature alignment calculation.
 */
export interface SpecSections {
  /** Functional requirements (FR-001, FR-002, etc.) */
  requirements: string[];

  /** User scenarios (US1, US2, etc.) */
  scenarios: string[];

  /** Key entities mentioned */
  entities: string[];

  /** Keywords extracted from content */
  keywords: string[];

  /** Raw section content for deeper analysis */
  rawSections: Record<string, string>;
}

/**
 * ComparisonSummary
 *
 * Summary of a comparison report for list views.
 * Maps to API ComparisonListResponse.comparisons items.
 */
export interface ComparisonSummary {
  /** Saved comparison identifier */
  id: number;

  /** Report generation timestamp (ISO string from API) */
  generatedAt: string;

  /** Source ticket key */
  sourceTicketKey: string;

  /** Participating ticket keys, ordered by rank when available */
  participantTicketKeys: string[];

  /** Winner ticket key */
  winnerTicketKey: string;

  /** Saved summary for the comparison */
  summary: string;

  /** Recommendation text when available */
  recommendation?: string;
}

/**
 * ComparisonCheckResult
 *
 * Result of checking if a ticket has comparisons.
 */
export interface ComparisonCheckResult {
  /** Whether any comparison reports exist */
  hasComparisons: boolean;

  /** Number of comparison reports */
  count: number;

  /** ID of the most recent comparison (if any) */
  latestComparisonId: number | null;
}

export type ComparisonEnrichmentState =
  | 'available'
  | 'pending'
  | 'unavailable';

export interface ComparisonEnrichmentValue<T> {
  state: ComparisonEnrichmentState;
  value: T | null;
}

export interface ComparisonTelemetryEnrichment {
  inputTokens: ComparisonEnrichmentValue<number>;
  outputTokens: ComparisonEnrichmentValue<number>;
  totalTokens: ComparisonEnrichmentValue<number>;
  durationMs: ComparisonEnrichmentValue<number>;
  costUsd: ComparisonEnrichmentValue<number>;
  jobCount: ComparisonEnrichmentValue<number>;
  hasPartialData: boolean;
}

export interface ComparisonMetricSnapshot {
  linesAdded: number | null;
  linesRemoved: number | null;
  linesChanged: number | null;
  filesChanged: number | null;
  testFilesChanged: number | null;
  changedFiles: string[];
  bestValueFlags: Record<string, boolean>;
}

export interface ComparisonParticipantDetail {
  ticketId: number;
  ticketKey: string;
  title: string;
  stage: Stage;
  workflowType: WorkflowType;
  agent: string | null;
  rank: number;
  score: number;
  rankRationale: string;
  quality: ComparisonEnrichmentValue<number>;
  qualityScoreDetails: QualityScoreDetails | null;
  telemetry: ComparisonTelemetryEnrichment;
  metrics: ComparisonMetricSnapshot;
  model: string | null;
}

export interface ComparisonDecisionPointApproach {
  ticketId: number;
  ticketKey: string;
  summary: string;
}

export interface ComparisonDecisionPoint {
  id: number;
  title: string;
  verdictTicketId: number | null;
  verdictSummary: string;
  rationale: string;
  displayOrder: number;
  participantApproaches: ComparisonDecisionPointApproach[];
}

export interface ComparisonComplianceCell {
  participantTicketId: number;
  participantTicketKey: string;
  status: 'pass' | 'mixed' | 'fail';
  notes: string;
}

export interface ComparisonComplianceRow {
  principleKey: string;
  principleName: string;
  displayOrder: number;
  assessments: ComparisonComplianceCell[];
}

export interface ComparisonDetail {
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
  decisionPoints: ComparisonDecisionPoint[];
  complianceRows: ComparisonComplianceRow[];
}

/**
 * BranchResolutionResult
 *
 * Result of resolving a ticket's branch for comparison.
 */
export interface BranchResolutionResult {
  /** Resolution status */
  status: 'resolved' | 'branch_missing' | 'merge_analyzed' | 'unavailable';

  /** Branch name (if resolved or branch_missing with pattern match) */
  branch?: string;

  /** Merge commit SHA (if merge_analyzed) */
  mergeCommitSha?: string;

  /** Error message (if unavailable) */
  error?: string;
}
