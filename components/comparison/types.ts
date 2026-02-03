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

