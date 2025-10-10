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
 * Validates that the status field is one of the allowed terminal states.
 * Only COMPLETED, FAILED, and CANCELLED are allowed from workflow updates.
 *
 * PENDING and RUNNING transitions are handled by separate mechanisms
 * (PENDING is default, RUNNING set when workflow starts).
 */
export const jobStatusUpdateSchema = z.object({
  status: z.enum(['COMPLETED', 'FAILED', 'CANCELLED'])
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
