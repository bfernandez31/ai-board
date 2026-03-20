/**
 * Stored Comparison Types
 *
 * Types for ticket comparisons stored in the database (TicketComparison + ComparisonEntry).
 * These are distinct from the file-based ComparisonReport types in comparison.ts.
 */

/** Decision point from implementation choices analysis */
export interface DecisionPoint {
  name: string;
  approaches: Record<string, string>;
  verdict: string;
  bestTicket: string;
}

/** Constitution principle compliance per ticket */
export interface CompliancePrinciple {
  name: string;
  section: string;
  passed: boolean;
  notes: string;
}

/** Entry in a stored comparison (one per ticket) */
export interface StoredComparisonEntry {
  ticketKey: string;
  rank: number;
  score: number;
  keyDifferentiator: string;
  linesAdded: number;
  linesRemoved: number;
  sourceFiles: number;
  testFiles: number;
  complianceScore: number | null;
  compliancePrinciples: CompliancePrinciple[] | null;
  decisionPoints: DecisionPoint[] | null;
}

/** Request body for creating a stored comparison */
export interface CreateComparisonRequest {
  projectId: number;
  sourceTicketKey: string;
  recommendation: string;
  winnerTicketKey?: string;
  entries: Omit<StoredComparisonEntry, 'compliancePrinciples' | 'decisionPoints'> & {
    compliancePrinciples?: CompliancePrinciple[];
    decisionPoints?: DecisionPoint[];
  }[];
}

/** Stored comparison with entries (API response) */
export interface StoredComparison {
  id: number;
  projectId: number;
  sourceTicketKey: string;
  recommendation: string;
  winnerTicketKey: string | null;
  createdAt: string;
  entries: StoredComparisonEntry[];
}

/** Enriched comparison entry with ticket metadata */
export interface EnrichedComparisonEntry extends StoredComparisonEntry {
  title: string | null;
  stage: string | null;
  workflowType: string | null;
  agent: string | null;
  qualityScore: number | null;
  costUsd: number | null;
  durationMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

/** Full enriched comparison (GET response) */
export interface EnrichedComparison {
  id: number;
  projectId: number;
  sourceTicketKey: string;
  recommendation: string;
  winnerTicketKey: string | null;
  createdAt: string;
  entries: EnrichedComparisonEntry[];
}

/** List of stored comparisons for a ticket */
export interface StoredComparisonListResponse {
  comparisons: StoredComparison[];
  total: number;
}
