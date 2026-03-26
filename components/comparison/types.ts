import type {
  ComparisonDashboardMetricDirection,
  ComparisonDashboardMetricKey,
  ComparisonDashboardMetricRow,
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

export const MISSION_CONTROL_SECTION_ORDER = [
  'winner-hero',
  'participant-ranking',
  'headline-metrics',
  'metric-matrix',
  'decision-points',
  'compliance',
] as const;

export type MissionControlSectionId =
  (typeof MISSION_CONTROL_SECTION_ORDER)[number];

export interface MissionControlMetricRowDescriptor {
  key: ComparisonDashboardMetricKey;
  label: string;
  category: ComparisonDashboardMetricRow['category'];
  bestDirection: ComparisonDashboardMetricDirection;
  supportsPopover?: boolean;
}

export const DASHBOARD_METRIC_ROW_DESCRIPTORS: MissionControlMetricRowDescriptor[] =
  [
    {
      key: 'costUsd',
      label: 'Cost',
      category: 'headline',
      bestDirection: 'lowest',
    },
    {
      key: 'durationMs',
      label: 'Duration',
      category: 'headline',
      bestDirection: 'lowest',
    },
    {
      key: 'qualityScore',
      label: 'Quality Score',
      category: 'headline',
      bestDirection: 'highest',
      supportsPopover: true,
    },
    {
      key: 'filesChanged',
      label: 'Files Changed',
      category: 'headline',
      bestDirection: 'lowest',
    },
    {
      key: 'linesChanged',
      label: 'Lines Changed',
      category: 'detail',
      bestDirection: 'lowest',
    },
    {
      key: 'filesChanged',
      label: 'Files Changed',
      category: 'detail',
      bestDirection: 'lowest',
    },
    {
      key: 'testFilesChanged',
      label: 'Test Files Changed',
      category: 'detail',
      bestDirection: 'highest',
    },
    {
      key: 'totalTokens',
      label: 'Total Tokens',
      category: 'detail',
      bestDirection: 'lowest',
    },
    {
      key: 'inputTokens',
      label: 'Input Tokens',
      category: 'detail',
      bestDirection: 'lowest',
    },
    {
      key: 'outputTokens',
      label: 'Output Tokens',
      category: 'detail',
      bestDirection: 'lowest',
    },
    {
      key: 'durationMs',
      label: 'Duration',
      category: 'detail',
      bestDirection: 'lowest',
    },
    {
      key: 'costUsd',
      label: 'Cost',
      category: 'detail',
      bestDirection: 'lowest',
    },
    {
      key: 'jobCount',
      label: 'Job Count',
      category: 'detail',
      bestDirection: 'lowest',
    },
    {
      key: 'qualityScore',
      label: 'Quality Score',
      category: 'detail',
      bestDirection: 'highest',
      supportsPopover: true,
    },
  ];

export interface ComparisonRankingProps extends ComparisonSectionProps {
  recommendation: string;
  summary: string;
  winnerTicketId: number;
  keyDifferentiators: string[];
  generatedAt: string;
  sourceTicketKey: string;
  winnerTicketKey: string;
  headlineMetrics: ComparisonDashboardMetricRow[];
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
  metricRows?: ComparisonDashboardMetricRow[];
}
