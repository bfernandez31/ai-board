/**
 * TypeScript Contract Definitions for Display Spec.md Feature
 *
 * These types define the contract between frontend and backend
 * for the spec retrieval API.
 */

import { z } from 'zod';

// ============================================================================
// Request Validation Schemas
// ============================================================================

/**
 * Path parameter validation for projectId
 */
export const ProjectIdParamSchema = z.string().regex(/^\d+$/, {
  message: 'Project ID must be numeric',
});

/**
 * Path parameter validation for ticketId
 */
export const TicketIdParamSchema = z.string().regex(/^\d+$/, {
  message: 'Ticket ID must be numeric',
});

// ============================================================================
// Response Types
// ============================================================================

/**
 * Metadata about the retrieved specification file
 */
export interface SpecMetadata {
  /** Ticket ID */
  ticketId: number;

  /** Git branch name where spec.md is located */
  branch: string;

  /** Project ID */
  projectId: number;

  /** File name (always "spec.md") */
  fileName: string;

  /** Full path in repository (e.g., "specs/022-feature/spec.md") */
  filePath: string;
}

/**
 * Successful response from GET /api/projects/:projectId/tickets/:id/spec
 */
export interface GetSpecResponse {
  /** Raw markdown content of spec.md file */
  content: string;

  /** Metadata about the specification file */
  metadata: SpecMetadata;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  /** Human-readable error message */
  error: string;

  /** Machine-readable error code (optional) */
  code?: string;

  /** Additional error details (optional) */
  message?: string;

  /** Current version for conflict errors (optional) */
  currentVersion?: number;
}

// ============================================================================
// Response Validation Schemas
// ============================================================================

/**
 * Zod schema for validating spec metadata
 */
export const SpecMetadataSchema = z.object({
  ticketId: z.number().int().positive(),
  branch: z.string().min(1).max(200),
  projectId: z.number().int().positive(),
  fileName: z.literal('spec.md'),
  filePath: z.string().regex(/^specs\/[^/]+\/spec\.md$/),
});

/**
 * Zod schema for validating successful spec response
 */
export const GetSpecResponseSchema = z.object({
  content: z.string().min(1),
  metadata: SpecMetadataSchema,
});

/**
 * Zod schema for validating error responses
 */
export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  message: z.string().optional(),
  currentVersion: z.number().int().optional(),
});

// ============================================================================
// Frontend Hook Types
// ============================================================================

/**
 * State for spec viewer component
 */
export interface SpecViewerState {
  /** Whether spec is currently being fetched */
  isLoading: boolean;

  /** Error message if fetch failed */
  error: string | null;

  /** Spec content if successfully fetched */
  content: string | null;

  /** Metadata about the spec file */
  metadata: SpecMetadata | null;
}

/**
 * Actions for spec viewer state management
 */
export type SpecViewerAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: GetSpecResponse }
  | { type: 'FETCH_ERROR'; payload: string }
  | { type: 'RESET' };

// ============================================================================
// Button Visibility Types
// ============================================================================

/**
 * Conditions for showing "View Specification" button
 */
export interface SpecButtonVisibility {
  /** Whether ticket has a branch assigned */
  hasBranch: boolean;

  /** Whether ticket has a completed "specify" job */
  hasCompletedSpecifyJob: boolean;

  /** Whether button should be visible (AND of above conditions) */
  isVisible: boolean;
}

/**
 * Job data for determining button visibility
 */
export interface JobSummary {
  id: number;
  command: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
}

/**
 * Ticket data needed for spec viewer
 */
export interface TicketWithJobs {
  id: number;
  branch: string | null;
  projectId: number;
  jobs: JobSummary[];
}

// ============================================================================
// API Client Types
// ============================================================================

/**
 * Parameters for fetching specification
 */
export interface FetchSpecParams {
  projectId: number;
  ticketId: number;
}

/**
 * Options for fetch spec API call
 */
export interface FetchSpecOptions {
  /** AbortController signal for request cancellation */
  signal?: AbortSignal;

  /** Custom fetch implementation (for testing) */
  fetch?: typeof globalThis.fetch;
}

/**
 * Result of fetch spec operation
 */
export type FetchSpecResult =
  | { success: true; data: GetSpecResponse }
  | { success: false; error: ErrorResponse; status: number };

// ============================================================================
// Test Mode Types
// ============================================================================

/**
 * Test mode configuration
 */
export interface TestModeConfig {
  /** Whether test mode is enabled */
  enabled: boolean;

  /** Mock content to return in test mode */
  mockContent?: string;

  /** Mock metadata to return in test mode */
  mockMetadata?: SpecMetadata;
}

// ============================================================================
// GitHub API Types
// ============================================================================

/**
 * Parameters for GitHub API getContent call
 */
export interface GitHubGetContentParams {
  owner: string;
  repo: string;
  path: string;
  ref: string;
}

/**
 * GitHub API content response (simplified)
 */
export interface GitHubContentResponse {
  content: string; // base64 encoded
  encoding: 'base64';
  name: string;
  path: string;
  sha: string;
  size: number;
}

// ============================================================================
// Utility Type Guards
// ============================================================================

/**
 * Type guard to check if response is an error
 */
export function isErrorResponse(response: unknown): response is ErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    typeof (response as ErrorResponse).error === 'string'
  );
}

/**
 * Type guard to check if response is successful spec response
 */
export function isGetSpecResponse(response: unknown): response is GetSpecResponse {
  const result = GetSpecResponseSchema.safeParse(response);
  return result.success;
}

/**
 * Type guard to check if job is completed specify job
 */
export function isCompletedSpecifyJob(job: JobSummary): boolean {
  return job.command === 'specify' && job.status === 'COMPLETED';
}

// ============================================================================
// Export all types
// ============================================================================

export type {
  // Request validation
  ProjectIdParamSchema as ProjectIdParamType,
  TicketIdParamSchema as TicketIdParamType,
};
