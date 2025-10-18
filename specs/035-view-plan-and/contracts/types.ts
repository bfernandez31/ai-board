/**
 * Type Definitions for View Plan and Tasks Documentation Feature
 *
 * This file contains all TypeScript interfaces, types, and enums for the
 * documentation viewing feature. These types are used across API routes,
 * React components, and utility functions.
 */

// ============================================================================
// Document Types
// ============================================================================

/**
 * Supported documentation types for viewing
 */
export type DocumentType = 'spec' | 'plan' | 'tasks';

/**
 * Human-readable labels for documentation types
 * Used in modal titles and button labels
 */
export const DocumentTypeLabels: Record<DocumentType, string> = {
  spec: 'Specification',
  plan: 'Implementation Plan',
  tasks: 'Task Breakdown',
};

/**
 * File names for documentation types
 * Used to construct GitHub API file paths
 */
export const DocumentTypeFiles: Record<DocumentType, string> = {
  spec: 'spec.md',
  plan: 'plan.md',
  tasks: 'tasks.md',
};

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Parameters for fetching documentation from GitHub
 * Used by lib/github/doc-fetcher.ts
 */
export interface DocumentFetchParams {
  /** GitHub repository owner/organization */
  owner: string;

  /** GitHub repository name */
  repo: string;

  /** Git branch or commit ref */
  branch: string;

  /** Document type to fetch (spec, plan, or tasks) */
  docType: DocumentType;
}

/**
 * Documentation content response from API
 * Returned by GET /api/projects/[projectId]/tickets/[id]/[docType]
 */
export interface DocumentContent {
  /** Markdown content of the documentation file */
  content: string;

  /** Metadata about the fetched document */
  metadata: {
    /** Ticket ID */
    ticketId: number;

    /** Git branch from which file was fetched */
    branch: string;

    /** Project ID for authorization context */
    projectId: number;

    /** Document type (spec, plan, or tasks) */
    docType: DocumentType;

    /** File name (e.g., 'plan.md') */
    fileName: string;

    /** Full file path in repository (e.g., 'specs/035-view-plan-and/plan.md') */
    filePath: string;

    /** Timestamp when content was fetched (ISO 8601) */
    fetchedAt: string;
  };
}

/**
 * Error codes for documentation API
 * Used for client-side error handling logic
 */
export enum DocumentErrorCode {
  /** Invalid projectId or ticketId */
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  /** Project not found */
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',

  /** Ticket not found */
  TICKET_NOT_FOUND = 'TICKET_NOT_FOUND',

  /** Ticket belongs to different project */
  WRONG_PROJECT = 'WRONG_PROJECT',

  /** Ticket has no branch assigned */
  BRANCH_NOT_ASSIGNED = 'BRANCH_NOT_ASSIGNED',

  /** Documentation file not found on GitHub */
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',

  /** Documentation not available yet (job not completed) */
  NOT_AVAILABLE_YET = 'NOT_AVAILABLE_YET',

  /** Documentation not merged to main (SHIP stage only) */
  NOT_MERGED = 'NOT_MERGED',

  /** GitHub API rate limit exceeded */
  RATE_LIMIT = 'RATE_LIMIT',

  /** GitHub API error */
  GITHUB_API_ERROR = 'GITHUB_API_ERROR',

  /** Internal server error */
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * Error response from documentation API
 * Returned when API request fails
 */
export interface DocumentError {
  /** Human-readable error message */
  error: string;

  /** Machine-readable error code for client logic */
  code: DocumentErrorCode;

  /** Optional additional context (not shown to end users) */
  message?: string;
}

// ============================================================================
// Component Props
// ============================================================================

/**
 * Props for DocumentationViewer component
 * Used by components/board/documentation-viewer.tsx
 */
export interface DocumentationViewerProps {
  /** Ticket ID to fetch documentation for */
  ticketId: number;

  /** Project ID for API authorization */
  projectId: number;

  /** Ticket title for display in modal header */
  ticketTitle: string;

  /** Document type to display (spec, plan, or tasks) */
  docType: DocumentType;

  /** Whether the modal is open */
  open: boolean;

  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;
}

/**
 * Props for documentation action buttons
 * Used in TicketDetailModal for View Spec, View Plan, View Tasks buttons
 */
export interface DocumentationButtonProps {
  /** Document type for this button */
  docType: DocumentType;

  /** Whether button should be visible */
  visible: boolean;

  /** Callback when button is clicked */
  onClick: () => void;

  /** Icon component to display (lucide-react icon) */
  icon: React.ComponentType<{ className?: string }>;

  /** Button label text */
  label: string;
}

// ============================================================================
// State Management (TanStack Query)
// ============================================================================

/**
 * Query key factory for documentation queries
 * Used by TanStack Query for caching and invalidation
 */
export const documentationKeys = {
  /** All documentation queries */
  all: ['documentation'] as const,

  /** All docs for a specific project */
  project: (projectId: number) => ['documentation', projectId] as const,

  /** All docs for a specific ticket */
  ticket: (projectId: number, ticketId: number) =>
    ['documentation', projectId, ticketId] as const,

  /** Specific document for a ticket */
  document: (projectId: number, ticketId: number, docType: DocumentType) =>
    ['documentation', projectId, ticketId, docType] as const,
};

/**
 * TanStack Query state for documentation fetching
 * Returned by useDocumentation hook
 */
export interface DocumentationQueryState {
  /** Documentation content (undefined until loaded) */
  data: DocumentContent | undefined;

  /** Loading state */
  isLoading: boolean;

  /** Error state */
  error: DocumentError | null;

  /** Whether query is currently fetching */
  isFetching: boolean;

  /** Refetch function to manually trigger reload */
  refetch: () => Promise<void>;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Branch selection result
 * Used by getBranchForTicket utility function
 */
export interface BranchSelection {
  /** Git branch to use for fetching documentation */
  branch: string;

  /** Whether fetching from main branch (true for SHIP stage) */
  isMainBranch: boolean;

  /** Whether branch is available (false if ticket.branch is null for non-SHIP) */
  isAvailable: boolean;
}

/**
 * Button visibility conditions
 * Used by TicketDetailModal to determine which buttons to show
 */
export interface ButtonVisibility {
  /** Show "View Spec" button */
  showSpec: boolean;

  /** Show "View Plan" button */
  showPlan: boolean;

  /** Show "View Tasks" button */
  showTasks: boolean;
}

/**
 * Job status summary for button visibility logic
 * Extracted from ticket.jobs array
 */
export interface JobStatusSummary {
  /** Whether ticket has completed "specify" job */
  hasCompletedSpecifyJob: boolean;

  /** Whether ticket has completed "plan" job */
  hasCompletedPlanJob: boolean;

  /** Whether ticket has completed "tasks" job (implementation started) */
  hasCompletedTasksJob: boolean;
}
