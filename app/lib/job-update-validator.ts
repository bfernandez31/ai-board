/**
 * Job Update Validation Schemas
 *
 * Zod schemas for validating Job status update requests.
 * Used by API endpoint to ensure type-safe request handling.
 *
 * @see specs/019-update-job-on/contracts/job-update-api.yaml for API contract
 */

import { z } from 'zod';

/**
 * Zod schema for Job status update requests.
 *
 * Validates that the status field is one of the allowed states.
 * RUNNING, COMPLETED, FAILED, and CANCELLED are allowed from workflow updates.
 *
 * PENDING is the default status when a Job is created and cannot be set via this endpoint.
 */
export const jobStatusUpdateSchema = z.object({
  status: z.enum(['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  qualityScore: z.number().int().min(0).max(100).optional(),
});

/**
 * TypeScript type inferred from the Zod schema.
 * Use this for type-safe function parameters and return values.
 *
 * @example
 * function updateJobStatus(data: JobStatusUpdate) {
 *   // data.status is typed as 'COMPLETED' | 'FAILED' | 'CANCELLED'
 * }
 */
export type JobStatusUpdate = z.infer<typeof jobStatusUpdateSchema>;
