/**
 * API Contract: Duplicate Ticket
 *
 * Endpoint: POST /api/projects/{projectId}/tickets/{id}/duplicate
 * Purpose: Create a duplicate of an existing ticket in INBOX stage
 */

import type { ClarificationPolicy, Stage, WorkflowType } from '@prisma/client';
import type { TicketAttachment } from '@/app/lib/types/ticket';

// ============================================================================
// Request
// ============================================================================

/**
 * No request body required - all data comes from the source ticket
 * URL Parameters:
 *   - projectId: number (validated as positive integer)
 *   - id: number (source ticket ID, validated as positive integer)
 */
export type DuplicateTicketRequest = void;

// ============================================================================
// Response Types
// ============================================================================

/**
 * Successful duplicate response (HTTP 201)
 */
export interface DuplicateTicketResponse {
  /** Database ID of the new ticket */
  id: number;

  /** Sequential number within project */
  ticketNumber: number;

  /** Human-readable key (e.g., "AIB-107") */
  ticketKey: string;

  /** Title with "Copy of " prefix */
  title: string;

  /** Description copied from source */
  description: string;

  /** Always INBOX for new tickets */
  stage: Stage;

  /** Always 1 for new tickets */
  version: number;

  /** Project ID (same as source) */
  projectId: number;

  /** Always null for new tickets */
  branch: string | null;

  /** Always null for new tickets */
  previewUrl: string | null;

  /** Always false for new tickets */
  autoMode: boolean;

  /** Always FULL for new tickets */
  workflowType: WorkflowType;

  /** Copied from source ticket */
  attachments: TicketAttachment[];

  /** Copied from source (or null if using project default) */
  clarificationPolicy: ClarificationPolicy | null;

  /** ISO 8601 timestamp */
  createdAt: string;

  /** ISO 8601 timestamp */
  updatedAt: string;
}

/**
 * Error response structure
 */
export interface DuplicateTicketErrorResponse {
  /** Human-readable error message */
  error: string;

  /** Machine-readable error code */
  code:
    | 'VALIDATION_ERROR'
    | 'AUTH_ERROR'
    | 'PROJECT_NOT_FOUND'
    | 'TICKET_NOT_FOUND'
    | 'DATABASE_ERROR';
}

// ============================================================================
// HTTP Status Codes
// ============================================================================

/**
 * Response Status Codes:
 *
 * 201 Created       - Ticket successfully duplicated
 * 400 Bad Request   - Invalid projectId or ticketId format
 * 401 Unauthorized  - User not authenticated
 * 404 Not Found     - Project or source ticket not found
 * 500 Internal      - Database or server error
 */

// ============================================================================
// Example Request/Response
// ============================================================================

/**
 * Example Request:
 *
 * POST /api/projects/3/tickets/42/duplicate
 * Authorization: (session cookie)
 * Content-Type: application/json
 * Body: (empty or {})
 */

/**
 * Example Success Response (201):
 *
 * {
 *   "id": 107,
 *   "ticketNumber": 107,
 *   "ticketKey": "AIB-107",
 *   "title": "Copy of Add login button",
 *   "description": "User story: As a user, I want to log in...",
 *   "stage": "INBOX",
 *   "version": 1,
 *   "projectId": 3,
 *   "branch": null,
 *   "previewUrl": null,
 *   "autoMode": false,
 *   "workflowType": "FULL",
 *   "attachments": [
 *     {
 *       "type": "uploaded",
 *       "url": "https://res.cloudinary.com/xxx/image/upload/v1/ai-board/tickets/42/mockup.png",
 *       "filename": "mockup.png",
 *       "mimeType": "image/png",
 *       "sizeBytes": 245760,
 *       "uploadedAt": "2025-01-15T10:30:00.000Z",
 *       "cloudinaryPublicId": "ai-board/tickets/42/mockup"
 *     }
 *   ],
 *   "clarificationPolicy": "PRAGMATIC",
 *   "createdAt": "2025-01-20T14:22:00.000Z",
 *   "updatedAt": "2025-01-20T14:22:00.000Z"
 * }
 */

/**
 * Example Error Response (404):
 *
 * {
 *   "error": "Ticket not found",
 *   "code": "TICKET_NOT_FOUND"
 * }
 */
