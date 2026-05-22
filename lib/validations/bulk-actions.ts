import { z } from 'zod';

const ticketIdsSchema = z.array(z.number().int().positive()).min(1);

export const bulkDeleteSchema = z.object({
  action: z.literal('delete'),
  ticketIds: ticketIdsSchema,
});

export const bulkMergeSchema = z.object({
  action: z.literal('merge'),
  ticketIds: z.array(z.number().int().positive()).min(2),
  mergedTitle: z.string().min(1).max(100),
  mergedDescription: z.string().max(10000),
  selectedAttachments: z.array(z.string()).max(5).default([]),
});

export const bulkUpdateAgentSchema = z.object({
  action: z.literal('update-agent'),
  ticketIds: ticketIdsSchema,
  agent: z.enum(['CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI']),
});

export const bulkUpdateModelSchema = z.object({
  action: z.literal('update-model'),
  ticketIds: ticketIdsSchema,
  model: z.string().min(1),
});

export const bulkActionSchema = z.discriminatedUnion('action', [
  bulkDeleteSchema,
  bulkMergeSchema,
  bulkUpdateAgentSchema,
  bulkUpdateModelSchema,
]);

export type BulkAction = z.infer<typeof bulkActionSchema>;
export type BulkDeleteAction = z.infer<typeof bulkDeleteSchema>;
export type BulkMergeAction = z.infer<typeof bulkMergeSchema>;
export type BulkUpdateAgentAction = z.infer<typeof bulkUpdateAgentSchema>;
export type BulkUpdateModelAction = z.infer<typeof bulkUpdateModelSchema>;
