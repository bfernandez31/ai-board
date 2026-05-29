import { z } from 'zod';
import { CLAUDE_MODEL_IDS, isClaudeModelId } from '@/lib/models/claude-models';
import { CODEX_MODEL_IDS, isCodexModelId } from '@/lib/models/codex-models';

export const claudeModelIdSchema = z.string().refine(isClaudeModelId, {
  message: `Unknown model ID. Allowed: ${CLAUDE_MODEL_IDS.join(', ')}`,
});

export const anyModelIdSchema = z.string().refine(
  (v) => isClaudeModelId(v) || isCodexModelId(v),
  {
    message: `Unknown model ID. Allowed Claude: ${CLAUDE_MODEL_IDS.join(', ')}. Allowed Codex: ${CODEX_MODEL_IDS.join(', ')}`,
  }
);

export const ticketModelOverrideSchema = z
  .object({
    specifyModel: anyModelIdSchema.nullable().optional(),
    planModel: anyModelIdSchema.nullable().optional(),
    implementModel: anyModelIdSchema.nullable().optional(),
    quickImplModel: anyModelIdSchema.nullable().optional(),
    verifyModel: anyModelIdSchema.nullable().optional(),
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
