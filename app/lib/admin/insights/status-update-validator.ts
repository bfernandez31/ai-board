import { z } from 'zod';
import { ARTIFACT_MAX_BYTES } from '@/app/lib/logs/schema';

export const adminInsightsReportStatusUpdateSchema = z.discriminatedUnion(
  'status',
  [
    z.object({
      status: z.literal('RUNNING'),
      workflowRunId: z.coerce.bigint().positive().optional(),
    }),
    z.object({
      status: z.literal('COMPLETED'),
      sessionsCount: z.number().int().nonnegative(),
      ticketsCount: z.number().int().nonnegative(),
      htmlBlobKey: z
        .string()
        .max(300)
        .regex(/^insights\/reports\/\d+\.html$/),
      htmlBlobSize: z.number().int().positive().max(ARTIFACT_MAX_BYTES),
    }),
    z.object({
      status: z.literal('FAILED'),
      errorReason: z.string().min(1).max(2000),
    }),
  ]
);

export type AdminInsightsReportStatusUpdate = z.infer<
  typeof adminInsightsReportStatusUpdateSchema
>;
