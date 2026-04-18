import { z } from 'zod';
import { CLAUDE_MODEL_IDS, isClaudeModelId } from '@/lib/models/claude-models';

export const claudeModelIdSchema = z.string().refine(isClaudeModelId, {
  message: `Unknown model ID. Allowed: ${CLAUDE_MODEL_IDS.join(', ')}`,
});

export const ticketModelOverrideSchema = z
  .object({
    specifyModel: claudeModelIdSchema.nullable().optional(),
    planModel: claudeModelIdSchema.nullable().optional(),
    implementModel: claudeModelIdSchema.nullable().optional(),
    quickImplModel: claudeModelIdSchema.nullable().optional(),
    verifyModel: claudeModelIdSchema.nullable().optional(),
    resetAll: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.resetAll === true ||
      d.specifyModel !== undefined ||
      d.planModel !== undefined ||
      d.implementModel !== undefined ||
      d.quickImplModel !== undefined ||
      d.verifyModel !== undefined,
    { message: 'At least one field must be provided' }
  )
  .refine(
    (d) =>
      d.resetAll !== true ||
      (d.specifyModel === undefined &&
        d.planModel === undefined &&
        d.implementModel === undefined &&
        d.quickImplModel === undefined &&
        d.verifyModel === undefined),
    { message: 'resetAll cannot be combined with individual stage fields' }
  );

export type TicketModelOverrideInput = z.infer<typeof ticketModelOverrideSchema>;
