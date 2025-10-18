/**
 * API Contract Definitions for View Plan and Tasks Documentation Feature
 *
 * This file defines the API endpoints, request/response formats, and validation
 * schemas for the documentation viewing feature.
 */

import { z } from 'zod';
import { DocumentType, DocumentErrorCode } from './types';

// ============================================================================
// Validation Schemas (Zod)
// ============================================================================

/**
 * Schema for DocumentType validation
 * Ensures only valid document types are accepted
 */
export const DocumentTypeSchema = z.enum(['spec', 'plan', 'tasks']);

/**
 * Schema for projectId parameter validation
 * Must be a positive integer (reused from existing validations)
 */
export const ProjectIdSchema = z.string().regex(/^\d+$/, 'Invalid project ID');

/**
 * Schema for ticketId parameter validation
 * Must be a positive integer
 */
export const TicketIdSchema = z.string().regex(/^\d+$/, 'Invalid ticket ID');

/**
 * Schema for DocumentContent API response validation
 * Validates structure and content constraints
 */
export const DocumentContentSchema = z.object({
  content: z.string().min(1).max(1048576), // Max 1MB
  metadata: z.object({
    ticketId: z.number().int().positive(),
    branch: z.string().min(1).max(200),
    projectId: z.number().int().positive(),
    docType: DocumentTypeSchema,
    fileName: z.string().regex(/^(spec|plan|tasks)\.md$/),
    filePath: z.string().regex(/^specs\/[^/]+\/(spec|plan|tasks)\.md$/),
    fetchedAt: z.string().datetime(),
  }),
});

/**
 * Schema for DocumentError API response validation
 */
export const DocumentErrorSchema = z.object({
  error: z.string(),
  code: z.nativeEnum(DocumentErrorCode),
  message: z.string().optional(),
});

// ============================================================================
// API Endpoints
// ============================================================================

/**
 * GET /api/projects/[projectId]/tickets/[id]/spec
 *
 * Retrieves the spec.md file for a ticket from GitHub.
 * EXISTING ENDPOINT - Updated to support branch selection based on ticket stage.
 *
 * @param projectId - Project ID (path parameter, validated as positive integer)
 * @param id - Ticket ID (path parameter, validated as positive integer)
 *
 * @returns 200 - DocumentContent with spec.md content
 * @returns 400 - Invalid projectId or ticketId (VALIDATION_ERROR)
 * @returns 403 - Ticket belongs to different project (WRONG_PROJECT)
 * @returns 404 - Project, ticket, or file not found (PROJECT_NOT_FOUND, TICKET_NOT_FOUND, FILE_NOT_FOUND)
 * @returns 404 - Branch not assigned (BRANCH_NOT_ASSIGNED)
 * @returns 404 - Spec not available yet (NOT_AVAILABLE_YET)
 * @returns 429 - GitHub API rate limit exceeded (RATE_LIMIT)
 * @returns 500 - GitHub API error or internal server error (GITHUB_API_ERROR, INTERNAL_ERROR)
 *
 * @example
 * // Request
 * GET /api/projects/1/tickets/123/spec
 *
 * // Response (200 OK)
 * {
 *   "content": "# Specification...",
 *   "metadata": {
 *     "ticketId": 123,
 *     "branch": "035-view-plan-and",
 *     "projectId": 1,
 *     "docType": "spec",
 *     "fileName": "spec.md",
 *     "filePath": "specs/035-view-plan-and/spec.md",
 *     "fetchedAt": "2025-10-18T10:30:00.000Z"
 *   }
 * }
 *
 * @example
 * // Error Response (404 Not Found)
 * {
 *   "error": "Specification file not found",
 *   "code": "FILE_NOT_FOUND",
 *   "message": "File does not exist at specs/035-view-plan-and/spec.md"
 * }
 */
export interface GetSpecEndpoint {
  method: 'GET';
  path: '/api/projects/[projectId]/tickets/[id]/spec';
  params: {
    projectId: string; // Validated as positive integer
    id: string; // Validated as positive integer
  };
  response: {
    200: z.infer<typeof DocumentContentSchema>;
    400: z.infer<typeof DocumentErrorSchema>;
    403: z.infer<typeof DocumentErrorSchema>;
    404: z.infer<typeof DocumentErrorSchema>;
    429: z.infer<typeof DocumentErrorSchema>;
    500: z.infer<typeof DocumentErrorSchema>;
  };
}

/**
 * GET /api/projects/[projectId]/tickets/[id]/plan
 *
 * Retrieves the plan.md file for a ticket from GitHub.
 * NEW ENDPOINT - Follows same pattern as spec endpoint.
 *
 * @param projectId - Project ID (path parameter, validated as positive integer)
 * @param id - Ticket ID (path parameter, validated as positive integer)
 *
 * @returns 200 - DocumentContent with plan.md content
 * @returns 400 - Invalid projectId or ticketId (VALIDATION_ERROR)
 * @returns 403 - Ticket belongs to different project (WRONG_PROJECT)
 * @returns 404 - Project, ticket, or file not found (PROJECT_NOT_FOUND, TICKET_NOT_FOUND, FILE_NOT_FOUND)
 * @returns 404 - Branch not assigned (BRANCH_NOT_ASSIGNED)
 * @returns 404 - Plan not available yet (NOT_AVAILABLE_YET)
 * @returns 429 - GitHub API rate limit exceeded (RATE_LIMIT)
 * @returns 500 - GitHub API error or internal server error (GITHUB_API_ERROR, INTERNAL_ERROR)
 *
 * @example
 * // Request
 * GET /api/projects/1/tickets/123/plan
 *
 * // Response (200 OK)
 * {
 *   "content": "# Implementation Plan...",
 *   "metadata": {
 *     "ticketId": 123,
 *     "branch": "035-view-plan-and",
 *     "projectId": 1,
 *     "docType": "plan",
 *     "fileName": "plan.md",
 *     "filePath": "specs/035-view-plan-and/plan.md",
 *     "fetchedAt": "2025-10-18T10:30:00.000Z"
 *   }
 * }
 */
export interface GetPlanEndpoint {
  method: 'GET';
  path: '/api/projects/[projectId]/tickets/[id]/plan';
  params: {
    projectId: string;
    id: string;
  };
  response: {
    200: z.infer<typeof DocumentContentSchema>;
    400: z.infer<typeof DocumentErrorSchema>;
    403: z.infer<typeof DocumentErrorSchema>;
    404: z.infer<typeof DocumentErrorSchema>;
    429: z.infer<typeof DocumentErrorSchema>;
    500: z.infer<typeof DocumentErrorSchema>;
  };
}

/**
 * GET /api/projects/[projectId]/tickets/[id]/tasks
 *
 * Retrieves the tasks.md file for a ticket from GitHub.
 * NEW ENDPOINT - Follows same pattern as spec endpoint.
 *
 * @param projectId - Project ID (path parameter, validated as positive integer)
 * @param id - Ticket ID (path parameter, validated as positive integer)
 *
 * @returns 200 - DocumentContent with tasks.md content
 * @returns 400 - Invalid projectId or ticketId (VALIDATION_ERROR)
 * @returns 403 - Ticket belongs to different project (WRONG_PROJECT)
 * @returns 404 - Project, ticket, or file not found (PROJECT_NOT_FOUND, TICKET_NOT_FOUND, FILE_NOT_FOUND)
 * @returns 404 - Branch not assigned (BRANCH_NOT_ASSIGNED)
 * @returns 404 - Tasks not available yet (NOT_AVAILABLE_YET)
 * @returns 429 - GitHub API rate limit exceeded (RATE_LIMIT)
 * @returns 500 - GitHub API error or internal server error (GITHUB_API_ERROR, INTERNAL_ERROR)
 *
 * @example
 * // Request
 * GET /api/projects/1/tickets/123/tasks
 *
 * // Response (200 OK)
 * {
 *   "content": "# Task Breakdown...",
 *   "metadata": {
 *     "ticketId": 123,
 *     "branch": "035-view-plan-and",
 *     "projectId": 1,
 *     "docType": "tasks",
 *     "fileName": "tasks.md",
 *     "filePath": "specs/035-view-plan-and/tasks.md",
 *     "fetchedAt": "2025-10-18T10:30:00.000Z"
 *   }
 * }
 */
export interface GetTasksEndpoint {
  method: 'GET';
  path: '/api/projects/[projectId]/tickets/[id]/tasks';
  params: {
    projectId: string;
    id: string;
  };
  response: {
    200: z.infer<typeof DocumentContentSchema>;
    400: z.infer<typeof DocumentErrorSchema>;
    403: z.infer<typeof DocumentErrorSchema>;
    404: z.infer<typeof DocumentErrorSchema>;
    429: z.infer<typeof DocumentErrorSchema>;
    500: z.infer<typeof DocumentErrorSchema>;
  };
}

// ============================================================================
// Error Response Helpers
// ============================================================================

/**
 * Helper function to create standardized error responses
 * Used across all documentation API endpoints
 */
export function createErrorResponse(
  code: DocumentErrorCode,
  error: string,
  message?: string
): z.infer<typeof DocumentErrorSchema> {
  return {
    error,
    code,
    message,
  };
}

/**
 * Standard error responses for common scenarios
 */
export const StandardErrors = {
  INVALID_PROJECT_ID: createErrorResponse(
    DocumentErrorCode.VALIDATION_ERROR,
    'Invalid project ID'
  ),

  INVALID_TICKET_ID: createErrorResponse(
    DocumentErrorCode.VALIDATION_ERROR,
    'Invalid ticket ID'
  ),

  PROJECT_NOT_FOUND: createErrorResponse(
    DocumentErrorCode.PROJECT_NOT_FOUND,
    'Project not found'
  ),

  TICKET_NOT_FOUND: createErrorResponse(
    DocumentErrorCode.TICKET_NOT_FOUND,
    'Ticket not found'
  ),

  WRONG_PROJECT: createErrorResponse(
    DocumentErrorCode.WRONG_PROJECT,
    'Forbidden'
  ),

  BRANCH_NOT_ASSIGNED: (docType: DocumentType) =>
    createErrorResponse(
      DocumentErrorCode.BRANCH_NOT_ASSIGNED,
      `${DocumentTypeLabels[docType]} not available`,
      'Ticket does not have a branch assigned'
    ),

  FILE_NOT_FOUND: (docType: DocumentType, branch: string) =>
    createErrorResponse(
      DocumentErrorCode.FILE_NOT_FOUND,
      `${DocumentTypeLabels[docType]} file not found`,
      `File does not exist at specs/${branch}/${DocumentTypeFiles[docType]}`
    ),

  NOT_AVAILABLE_YET: (docType: DocumentType, jobCommand: string) =>
    createErrorResponse(
      DocumentErrorCode.NOT_AVAILABLE_YET,
      `${DocumentTypeLabels[docType]} not available`,
      `Ticket does not have a completed "${jobCommand}" job`
    ),

  NOT_MERGED: (docType: DocumentType) =>
    createErrorResponse(
      DocumentErrorCode.NOT_MERGED,
      `${DocumentTypeLabels[docType]} not yet merged`,
      'Ticket is shipped but documentation not found on main branch'
    ),

  RATE_LIMIT: createErrorResponse(
    DocumentErrorCode.RATE_LIMIT,
    'GitHub API rate limit exceeded'
  ),

  GITHUB_API_ERROR: createErrorResponse(
    DocumentErrorCode.GITHUB_API_ERROR,
    'Failed to fetch specification'
  ),

  INTERNAL_ERROR: createErrorResponse(
    DocumentErrorCode.INTERNAL_ERROR,
    'Internal server error'
  ),
};

// Re-export DocumentTypeLabels and DocumentTypeFiles for error helpers
import { DocumentTypeLabels, DocumentTypeFiles } from './types';
