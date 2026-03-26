/**
 * Comparison Component Types
 *
 * TypeScript interfaces specific to comparison UI components.
 */

import type {
  ComparisonComplianceRow,
  ComparisonDecisionPoint,
  ComparisonEnrichmentState,
  ComparisonParticipantDetail,
  ComparisonSummary,
} from '@/lib/types/comparison';

/**
 * ComparisonViewerProps
 *
 * Props for the comparison viewer component.
 */
export interface ComparisonViewerProps {
  /** Project ID for API calls */
  projectId: number;

  /** Ticket ID used for authorization and history discovery */
  ticketId: number;

  /** Selected comparison ID (optional - latest is loaded by default) */
  initialComparisonId?: number | null;

  /** Callback when report is closed */
  onClose?: () => void;

  /** Whether the viewer is open */
  isOpen: boolean;
}

export interface ComparisonHistoryListProps {
  comparisons: ComparisonSummary[];
  selectedComparisonId: number | null;
  isLoading?: boolean;
  onSelect: (comparisonId: number) => void;
}

export interface ComparisonSectionProps {
  participants: ComparisonParticipantDetail[];
}

export interface ComparisonRankingProps extends ComparisonSectionProps {
  recommendation: string;
  summary: string;
  winnerTicketId: number;
  keyDifferentiators: string[];
}

export interface ComparisonDecisionPointsProps {
  decisionPoints: ComparisonDecisionPoint[];
}

export interface ComparisonComplianceGridProps {
  rows: ComparisonComplianceRow[];
  participants: ComparisonParticipantDetail[];
}

export interface OperationalMetricDefinition {
  key: string;
  label: string;
  direction: 'lowest' | 'highest';
  format: (value: number) => string;
}

export interface OperationalMetricCell {
  ticketId: number;
  state: ComparisonEnrichmentState;
  value: number | null;
  formattedValue: string | null;
  isBest: boolean;
}

export interface OperationalMetricRow {
  definition: OperationalMetricDefinition;
  cells: OperationalMetricCell[];
}

export interface ComparisonOperationalMetricsGridProps extends ComparisonSectionProps {}

export interface ComparisonQualityPopoverProps {
  qualityDetails: import('@/lib/quality-score').QualityScoreDetails | null;
  qualityScore: number | null;
}
