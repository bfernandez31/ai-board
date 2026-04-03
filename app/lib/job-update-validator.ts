import { z } from 'zod';

/** Validates Job status update requests. PENDING cannot be set via API. */
export const jobStatusUpdateSchema = z.object({
  status: z.enum(['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  workflowRunId: z.number().int().positive().optional(),
  qualityScore: z.number().int().min(0).max(100).optional(),
  qualityScoreDetails: z.string().optional(),
});

export type JobStatusUpdate = z.infer<typeof jobStatusUpdateSchema>;
