import { z } from 'zod';
import { CLAUDE_MODEL_IDS, isClaudeModelId } from '@/lib/models/claude-models';
import { CODEX_MODEL_IDS } from '@/lib/models/codex-models';
import { isKnownModelId } from '@/lib/models/agent-models';

// Kept for backward compatibility with consumers that need Claude-only validation.
export const claudeModelIdSchema = z.string().refine(isClaudeModelId, {
  message: `Unknown model ID. Allowed: ${CLAUDE_MODEL_IDS.join(', ')}`,
});

// Accepts any model ID supported by a configurable agent (Claude or Codex). The
// runtime resolver (lib/workflows/model-resolution.ts) ignores values that
// don't match the effective agent — they are stored verbatim but inactive
// until the matching agent is selected.
export const agentModelIdSchema = z.string().refine(isKnownModelId, {
  message: `Unknown model ID. Allowed: ${[...CLAUDE_MODEL_IDS, ...CODEX_MODEL_IDS].join(', ')}`,
});

export const ticketModelOverrideSchema = z
  .object({
    specifyModel: agentModelIdSchema.nullable().optional(),
    planModel: agentModelIdSchema.nullable().optional(),
    implementModel: agentModelIdSchema.nullable().optional(),
    quickImplModel: agentModelIdSchema.nullable().optional(),
    verifyModel: agentModelIdSchema.nullable().optional(),
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
