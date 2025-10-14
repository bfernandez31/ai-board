/**
 * Zod validation schemas for job polling API
 *
 * These schemas define the request/response contracts for the
 * GET /api/projects/[projectId]/jobs/status endpoint.
 *
 * Aligned with OpenAPI spec in specs/028-519-replace-sse/contracts/job-polling-api.yml
 */

import { z } from 'zod';

/**
 * Job status DTO schema
 *
 * Represents a single job's status information for polling.
 * Excludes sensitive fields (command, createdAt, completedAt).
 */
export const JobStatusDtoSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  ticketId: z.number().int().positive(),
  updatedAt: z.string().datetime(), // ISO 8601 format
});

/**
 * Job status response schema
 *
 * Response body for GET /api/projects/[projectId]/jobs/status
 */
export const JobStatusResponseSchema = z.object({
  jobs: z.array(JobStatusDtoSchema),
});

/**
 * Error response schema
 *
 * Standard error response format for all error cases
 */
export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
});

/**
 * TypeScript types inferred from schemas
 */
export type JobStatusDto = z.infer<typeof JobStatusDtoSchema>;
export type JobStatusResponse = z.infer<typeof JobStatusResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Helper to check if a job status is terminal (no further state changes)
 */
export const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED'] as const;

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.includes(status as typeof TERMINAL_STATUSES[number]);
}
