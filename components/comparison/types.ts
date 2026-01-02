/**
 * Comparison Component Types
 *
 * TypeScript interfaces specific to comparison UI components.
 * Re-exports core types from lib/types/comparison.ts for convenience.
 */

// Re-export core comparison types
export type {
  ComparisonReport,
  ComparisonSummary,
  ComparisonCheckResult,
  FeatureAlignmentScore,
  ConstitutionComplianceScore,
  TicketTelemetry,
  ImplementationMetrics,
} from '@/lib/types/comparison';

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

/**
 * ComparisonHistoryProps
 *
 * Props for the comparison history component.
 */
export interface ComparisonHistoryProps {
  /** Project ID for API calls */
  projectId: number;

  /** Ticket ID to show history for */
  ticketId: number;

  /** Currently selected report filename */
  selectedReport?: string;

  /** Callback when a report is selected */
  onSelectReport: (filename: string) => void;
}

/**
 * ComparisonButtonProps
 *
 * Props for the Compare button shown in ticket detail modal.
 */
export interface ComparisonButtonProps {
  /** Project ID for API calls */
  projectId: number;

  /** Ticket ID to check comparisons for */
  ticketId: number;

  /** Callback when button is clicked */
  onClick: () => void;
}

/**
 * AlignmentBadgeProps
 *
 * Props for displaying alignment score badge.
 */
export interface AlignmentBadgeProps {
  /** Alignment score (0-100) */
  score: number;

  /** Whether alignment meets threshold */
  isAligned: boolean;

  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * ComplianceIndicatorProps
 *
 * Props for displaying constitution compliance indicator.
 */
export interface ComplianceIndicatorProps {
  /** Number of passed principles */
  passed: number;

  /** Total number of principles */
  total: number;

  /** Whether to show detailed breakdown */
  showDetails?: boolean;
}

/**
 * TelemetryComparisonProps
 *
 * Props for displaying telemetry comparison table.
 */
export interface TelemetryComparisonProps {
  /** Telemetry data keyed by ticket key */
  telemetry: Record<string, import('@/lib/types/comparison').TicketTelemetry>;

  /** Order of tickets to display */
  ticketOrder: string[];
}

/**
 * MetricsComparisonProps
 *
 * Props for displaying implementation metrics comparison.
 */
export interface MetricsComparisonProps {
  /** Metrics data keyed by ticket key */
  metrics: Record<string, import('@/lib/types/comparison').ImplementationMetrics>;

  /** Order of tickets to display */
  ticketOrder: string[];
}
