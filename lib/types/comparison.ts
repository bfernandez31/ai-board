/**
 * Ticket Comparison Types
 *
 * TypeScript interfaces for the ticket comparison feature (AIB-123).
 * These types define the data structures for parsing, analysis, and reporting.
 */

import type { Stage, WorkflowType } from '@prisma/client';

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
  /** Report filename */
  filename: string;

  /** Report generation timestamp (ISO string from API) */
  generatedAt: string;

  /** Source ticket key */
  sourceTicket: string;

  /** Compared ticket keys */
  comparedTickets: string[];

  /** Overall alignment score (0-100) */
  alignmentScore: number;

  /** Whether alignment is above threshold (30%) */
  isAligned: boolean;

  /** Winner ticket key when ranking data is available */
  winnerTicketKey?: string;

  /** Winner score when ranking data is available */
  winnerScore?: number;
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

  /** Filename of most recent report (if any) */
  latestReport: string | null;
}

export type ComparisonPrincipleStatus = 'pass' | 'warning' | 'fail';

export interface ComparisonStoredMetrics {
  linesAdded: number;
  linesRemoved: number;
  sourceFiles: number;
  testFiles: number;
  testRatio: number;
}

export interface ComparisonStoredPrinciple {
  principle: string;
  status: ComparisonPrincipleStatus;
  summary: string;
}

export interface ComparisonStoredConstitution {
  overall: number;
  principles: ComparisonStoredPrinciple[];
}

export interface ComparisonDecisionApproach {
  ticketId: number;
  approach: string;
  rationale: string;
}

export interface ComparisonDecisionPoint {
  title: string;
  verdict: string;
  winningTicketId: number | null;
  approaches: ComparisonDecisionApproach[];
}

export interface ComparisonQualityScoreSummary {
  score: number | null;
  threshold: string | null;
}

export interface ComparisonTicketView {
  ticketId: number;
  ticketKey: string;
  title: string;
  workflowType: WorkflowType;
  stage: Stage;
  agent: string | null;
  rank: number;
  score: number;
  verdictSummary: string;
  keyDifferentiators: string[];
  metrics: ComparisonStoredMetrics;
  telemetry: TicketTelemetry;
  qualityScore: ComparisonQualityScoreSummary;
  constitution: ComparisonStoredConstitution;
}

export interface ComparisonTicketReference {
  id: number;
  ticketKey: string;
  title: string;
}

export interface ComparisonDetail {
  id: number;
  filename: string;
  reportPath: string;
  generatedAt: string;
  summary: string;
  recommendation: string;
  sourceTicket: ComparisonTicketReference;
  winnerTicket: ComparisonTicketReference | null;
  tickets: ComparisonTicketView[];
  decisionPoints: ComparisonDecisionPoint[];
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
