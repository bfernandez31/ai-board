/**
 * Comparison Component Types
 *
 * TypeScript interfaces specific to comparison UI components.
 */

/**
 * ComparisonViewerProps
 *
 * Props for the comparison viewer component.
 */
export interface ComparisonViewerProps {
  /** Project ID for API calls */
  projectId: number;

  /** Ticket ID where comparison was triggered */
  ticketId: number;

  /** Selected report filename (optional - shows latest if not provided) */
  selectedReport?: string;

  /** Callback when report is closed */
  onClose?: () => void;

  /** Whether the viewer is open */
  isOpen: boolean;
}

export interface ComparisonEntryData {
  id: number;
  rank: number;
  score: number;
  isWinner: boolean;
  keyDifferentiators: string;
  metrics: {
    linesAdded: number;
    linesRemoved: number;
    sourceFileCount: number;
    testFileCount: number;
    testRatio: number;
  };
  complianceData: Array<{ name: string; passed: boolean; notes?: string }>;
  ticket: {
    id: number;
    ticketKey: string;
    title: string;
    stage: string;
    workflowType: string;
    branch: string | null;
  } | null;
  telemetry: {
    totalCostUsd: number;
    totalDurationMs: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    model: string;
  } | null;
  qualityScore: {
    score: number;
    details: Record<string, unknown>;
  } | null;
}

export interface ComparisonDecisionPointData {
  id: number;
  topic: string;
  verdict: string;
  approaches: Record<string, { approach: string; assessment: string }>;
}

export interface EnrichedComparison {
  id: number;
  projectId: number;
  sourceTicketKey: string;
  recommendation: string;
  notes: string | null;
  createdAt: string;
  entries: ComparisonEntryData[];
  decisionPoints: ComparisonDecisionPointData[];
}

export interface ComparisonListItem {
  id: number;
  sourceTicketKey: string;
  recommendation: string;
  createdAt: string;
  entryCount: number;
  ticketRank?: number;
  ticketScore?: number;
  ticketIsWinner?: boolean;
  winnerTicketKey: string | null;
  winnerScore?: number | null;
}

export interface ComparisonListResponse {
  comparisons: ComparisonListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ComparisonCheckResponse {
  hasComparisons: boolean;
  count: number;
}

