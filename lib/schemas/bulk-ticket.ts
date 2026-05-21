import { z } from 'zod';
import { Agent } from '@prisma/client';
import { isClaudeModelId, STAGE_MODEL_KEYS } from '@/lib/models/claude-models';
import { isTicketAttachment, type TicketAttachment } from '@/app/lib/types/ticket';

/**
 * Shared reference to a ticket with its optimistic-concurrency version,
 * used by every bulk ticket operation request payload.
 */
export const ticketRefSchema = z.object({
  id: z.number().int().positive(),
  version: z.number().int().positive(),
});

export type TicketRef = z.infer<typeof ticketRefSchema>;

/**
 * 1..50 ticket refs per bulk request (FR-004 cap, mirrored client-side).
 */
export const ticketsArraySchema = z.array(ticketRefSchema).min(1).max(50);

export const bulkDeleteSchema = z.object({
  tickets: ticketsArraySchema,
});

export type BulkDeleteRequest = z.infer<typeof bulkDeleteSchema>;

export const bulkAgentSchema = z.object({
  agent: z.nativeEnum(Agent).nullable(),
  tickets: ticketsArraySchema,
});

export type BulkAgentRequest = z.infer<typeof bulkAgentSchema>;

const stageModelKeyEnum = z.enum(STAGE_MODEL_KEYS as readonly [
  'specifyModel',
  'planModel',
  'implementModel',
  'quickImplModel',
  'verifyModel',
]);

export const bulkModelSchema = z.object({
  stage: stageModelKeyEnum,
  model: z
    .string()
    .max(50)
    .refine(isClaudeModelId, { message: 'Unknown model ID' })
    .nullable(),
  tickets: ticketsArraySchema,
});

export type BulkModelRequest = z.infer<typeof bulkModelSchema>;

const ticketAttachmentZodSchema = z.custom<TicketAttachment>(
  (value) => isTicketAttachment(value),
  { message: 'Invalid attachment shape' },
);

export const fusionSchema = z
  .object({
    anchorId: z.number().int().positive(),
    anchorVersion: z.number().int().positive(),
    title: z.string().min(1).max(100),
    description: z.string().min(1).max(10000),
    attachments: z.array(ticketAttachmentZodSchema).max(5),
    absorbed: z.array(ticketRefSchema).min(1),
  })
  .refine((data) => !data.absorbed.some((a) => a.id === data.anchorId), {
    message: 'anchorId cannot also appear in absorbed[]',
    path: ['absorbed'],
  })
  .refine((data) => 1 + data.absorbed.length <= 50, {
    message: 'Total tickets (anchor + absorbed) cannot exceed 50',
    path: ['absorbed'],
  })
  .refine(
    (data) => {
      const ids = data.absorbed.map((a) => a.id);
      return new Set(ids).size === ids.length;
    },
    { message: 'Duplicate ids in absorbed[]', path: ['absorbed'] },
  );

export type FusionRequest = z.infer<typeof fusionSchema>;
