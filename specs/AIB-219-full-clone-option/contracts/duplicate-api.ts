/**
 * API Contract: Ticket Duplication Endpoint
 * Feature: AIB-219 Full Clone Option
 *
 * Extends existing duplicate endpoint with mode parameter
 */

import type { Stage, WorkflowType, ClarificationPolicy, JobStatus } from '@prisma/client';

// ============================================================================
// Request Types
// ============================================================================

/**
 * Duplication mode
 * - "simple": Creates copy in INBOX, no branch, no jobs (existing behavior)
 * - "full": Preserves stage, copies jobs, creates new branch from source
 */
export type DuplicateMode = 'simple' | 'full';

/**
 * Request body for POST /api/projects/{projectId}/tickets/{id}/duplicate
 */
export interface DuplicateTicketRequest {
  /**
   * Duplication mode
   * @default "simple"
   */
  mode?: DuplicateMode;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Job data included in full clone response
 */
export interface ClonedJobResponse {
  id: number;
  command: string;
  status: JobStatus;
  branch: string | null;
  commitSha: string | null;
  startedAt: string; // ISO 8601
  completedAt: string | null; // ISO 8601
  // Telemetry
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;
  costUsd: number | null;
  durationMs: number | null;
  model: string | null;
  toolsUsed: string[];
}

/**
 * Successful duplication response (201 Created)
 */
export interface DuplicateTicketResponse {
  id: number;
  ticketNumber: number;
  ticketKey: string;
  title: string;
  description: string;
  stage: Stage;
  version: number;
  projectId: number;
  branch: string | null;
  previewUrl: string | null;
  autoMode: boolean;
  workflowType: WorkflowType;
  attachments: unknown[];
  clarificationPolicy: ClarificationPolicy | null;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  /**
   * Jobs included only for full clone mode
   */
  jobs?: ClonedJobResponse[];
}

/**
 * Error response structure
 */
export interface DuplicateErrorResponse {
  error: string;
  code: DuplicateErrorCode;
}

export type DuplicateErrorCode =
  | 'VALIDATION_ERROR' // Invalid projectId or ticketId
  | 'AUTH_ERROR' // User not authorized
  | 'PROJECT_NOT_FOUND' // Project doesn't exist
  | 'TICKET_NOT_FOUND' // Ticket doesn't exist
  | 'MISSING_BRANCH' // Full clone requires source branch
  | 'BRANCH_NOT_FOUND' // Source branch doesn't exist on GitHub
  | 'BRANCH_CREATION_FAILED' // GitHub API error creating branch
  | 'DATABASE_ERROR'; // Database operation failed

// ============================================================================
// HTTP Contract
// ============================================================================

/**
 * POST /api/projects/{projectId}/tickets/{id}/duplicate
 *
 * Path Parameters:
 *   - projectId: number (positive integer)
 *   - id: number (positive integer, ticket ID)
 *
 * Request Body (optional):
 *   - mode: "simple" | "full" (default: "simple")
 *
 * Response Codes:
 *   - 201 Created: Ticket duplicated successfully
 *   - 400 Bad Request: Invalid parameters or missing branch for full clone
 *   - 401 Unauthorized: User not authenticated
 *   - 403 Forbidden: User not authorized for project
 *   - 404 Not Found: Project or ticket not found
 *   - 500 Internal Server Error: Database or GitHub API error
 *
 * Headers:
 *   - Content-Type: application/json
 *
 * Example Request (simple copy):
 *   POST /api/projects/1/tickets/42/duplicate
 *   Content-Type: application/json
 *   {}
 *
 * Example Request (full clone):
 *   POST /api/projects/1/tickets/42/duplicate
 *   Content-Type: application/json
 *   { "mode": "full" }
 *
 * Example Response (201 Created, full clone):
 *   {
 *     "id": 456,
 *     "ticketNumber": 219,
 *     "ticketKey": "AIB-219",
 *     "title": "Clone of Original Feature",
 *     "stage": "PLAN",
 *     "branch": "219-original-feature",
 *     "jobs": [
 *       {
 *         "id": 789,
 *         "command": "specify",
 *         "status": "COMPLETED",
 *         "inputTokens": 1500,
 *         "outputTokens": 3000,
 *         ...
 *       }
 *     ],
 *     ...
 *   }
 */
export type DuplicateTicketEndpoint = {
  path: '/api/projects/:projectId/tickets/:id/duplicate';
  method: 'POST';
  pathParams: {
    projectId: string; // Parsed as number
    id: string; // Parsed as number
  };
  body: DuplicateTicketRequest;
  response: DuplicateTicketResponse;
  errors: DuplicateErrorResponse;
};
