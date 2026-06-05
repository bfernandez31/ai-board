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
  qualityScoreDetails: z.string().optional(),
  workflowRunId: z.number().int().positive().optional(),
  // AIB-779: runtime versions captured by the runner at job start.
  // Both fields are optional — failure to capture leaves the job unannotated.
  pluginVersion: z.string().trim().min(1).max(50).optional(),
  agentCliVersion: z.string().trim().min(1).max(100).optional(),
  // AIB-849: per-job token-saving outcome reported by the runner at job start.
  tokenSavingOutcome: z.enum(['ACTIVE', 'INACTIVE', 'FELL_BACK']).optional(),
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
