import { z } from 'zod';
import { CLAUDE_MODEL_IDS, isClaudeModelId } from '@/lib/models/claude-models';
import { CODEX_MODEL_IDS, isCodexModelId } from '@/lib/models/codex-models';

export const claudeModelIdSchema = z.string().refine(isClaudeModelId, {
  message: `Unknown model ID. Allowed: ${CLAUDE_MODEL_IDS.join(', ')}`,
});

export const codexModelIdSchema = z.string().refine(isCodexModelId, {
  message: `Unknown model ID. Allowed: ${CODEX_MODEL_IDS.join(', ')}`,
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

export const ticketCodexModelOverrideSchema = z
  .object({
    codexSpecifyModel: codexModelIdSchema.nullable().optional(),
    codexPlanModel: codexModelIdSchema.nullable().optional(),
    codexImplementModel: codexModelIdSchema.nullable().optional(),
    codexQuickImplModel: codexModelIdSchema.nullable().optional(),
    codexVerifyModel: codexModelIdSchema.nullable().optional(),
    resetAll: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.resetAll === true ||
      d.codexSpecifyModel !== undefined ||
      d.codexPlanModel !== undefined ||
      d.codexImplementModel !== undefined ||
      d.codexQuickImplModel !== undefined ||
      d.codexVerifyModel !== undefined,
    { message: 'At least one field must be provided' }
  )
  .refine(
    (d) =>
      d.resetAll !== true ||
      (d.codexSpecifyModel === undefined &&
        d.codexPlanModel === undefined &&
        d.codexImplementModel === undefined &&
        d.codexQuickImplModel === undefined &&
        d.codexVerifyModel === undefined),
    { message: 'resetAll cannot be combined with individual stage fields' }
  );

export type TicketCodexModelOverrideInput = z.infer<typeof ticketCodexModelOverrideSchema>;
