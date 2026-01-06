/**
 * API Contracts: Close Ticket Feature
 *
 * Feature: AIB-147-close-ticket-feature
 * Date: 2026-01-06
 *
 * Defines the API request/response shapes for ticket closure operations.
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * Extended Stage enum including CLOSED
 */
export type Stage =
  | 'INBOX'
  | 'SPECIFY'
  | 'PLAN'
  | 'BUILD'
  | 'VERIFY'
  | 'SHIP'
  | 'CLOSED';

// ============================================================================
// Transition Endpoint (Extended)
// ============================================================================

/**
 * POST /api/projects/{projectId}/tickets/{id}/transition
 *
 * Extended to support VERIFY → CLOSED transition.
 * CLOSED is now a valid targetStage value.
 */
export interface TransitionRequest {
  targetStage: Stage;
}

export interface TransitionResponse {
  id: number;
  stage: Stage;
  workflowType: 'FULL' | 'QUICK' | 'CLEAN';
  branch: string | null;
  version: number;
  closedAt?: string | null; // ISO date string, present when stage is CLOSED
  updatedAt: string;
  jobId?: number; // Present for workflow stages, absent for CLOSED
  prsClosed?: number; // Present for CLOSED transition, number of PRs closed
}

export interface TransitionErrorResponse {
  error: string;
  code?:
    | 'INVALID_TRANSITION'
    | 'CLEANUP_IN_PROGRESS'
    | 'JOB_NOT_COMPLETED'
    | 'GITHUB_ERROR';
  details?: {
    currentStage?: Stage;
    targetStage?: Stage;
    jobStatus?: string;
  };
}

// ============================================================================
// Search Endpoint (Extended)
// ============================================================================

/**
 * GET /api/projects/{projectId}/tickets/search?q={query}&limit={limit}
 *
 * Extended response includes CLOSED tickets with closedAt field.
 */
export interface SearchResultItem {
  id: number;
  ticketKey: string;
  title: string;
  stage: Stage;
  closedAt?: string | null; // ISO date string, present when stage is CLOSED
}

export interface SearchResponse {
  results: SearchResultItem[];
  totalCount: number;
}

// ============================================================================
// Ticket Detail (Extended)
// ============================================================================

/**
 * GET /api/projects/{projectId}/tickets/{id}
 *
 * Extended response includes closedAt field.
 */
export interface TicketDetailResponse {
  id: number;
  ticketKey: string;
  ticketNumber: number;
  title: string;
  description: string | null;
  stage: Stage;
  version: number;
  projectId: number;
  branch: string | null;
  previewUrl: string | null;
  autoMode: boolean;
  workflowType: 'FULL' | 'QUICK' | 'CLEAN';
  clarificationPolicy: 'AUTO' | 'CONSERVATIVE' | 'PRAGMATIC' | 'INTERACTIVE' | null;
  closedAt: string | null; // ISO date string or null
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Close Validation
// ============================================================================

/**
 * Client-side validation result for close eligibility
 */
export interface CloseValidation {
  allowed: boolean;
  reason?: string;
}

// ============================================================================
// HTTP Status Codes
// ============================================================================

/**
 * Status codes for transition endpoint
 *
 * 200 - Success (ticket transitioned)
 * 400 - Invalid transition (wrong stage, validation failed)
 * 404 - Ticket not found
 * 409 - Version conflict (OCC failure)
 * 423 - Locked (cleanup in progress)
 * 500 - Internal server error
 */
export type TransitionStatusCode = 200 | 400 | 404 | 409 | 423 | 500;
