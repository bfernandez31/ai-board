import type {
  ComparisonComplianceRow,
  ComparisonDecisionPoint,
  ComparisonParticipantDetail,
  ComparisonSummary,
} from '@/lib/types/comparison';

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

export interface OperationalMetricsProps {
  participants: ComparisonParticipantDetail[];
}

export interface ComparisonHeroCardProps {
  winner: ComparisonParticipantDetail;
  recommendation: string;
  keyDifferentiators: string[];
  generatedAt: string;
  sourceTicketKey: string;
}

export interface ComparisonParticipantGridProps {
  participants: ComparisonParticipantDetail[];
}

export interface ComparisonStatCardsProps {
  winner: ComparisonParticipantDetail;
  participants: ComparisonParticipantDetail[];
}

export interface ComparisonUnifiedMetricsProps {
  participants: ComparisonParticipantDetail[];
}

export interface ComparisonComplianceHeatmapProps {
  rows: ComparisonComplianceRow[];
  participants: ComparisonParticipantDetail[];
}

export interface ComparisonDecisionPointsEnhancedProps {
  decisionPoints: ComparisonDecisionPoint[];
  winnerTicketId: number;
}
