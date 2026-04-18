import { z } from 'zod';
import { ClarificationPolicy, Agent } from '@prisma/client';
import { CLAUDE_MODEL_IDS } from '@/lib/workflows/claude-models';

export const projectClarificationPolicySchema = z.nativeEnum(ClarificationPolicy);

const claudeModelIdSchema = z.enum(CLAUDE_MODEL_IDS as [string, ...string[]]);

export const claudeModelMapSchema = z
  .object({
    specify: claudeModelIdSchema.optional(),
    plan: claudeModelIdSchema.optional(),
    implement: claudeModelIdSchema.optional(),
    quickImpl: claudeModelIdSchema.optional(),
    verify: claudeModelIdSchema.optional(),
  })
  .strict();

export const claudeModelOverridesSchema = claudeModelMapSchema;

export const projectUpdateSchema = z.object({
  clarificationPolicy: projectClarificationPolicySchema.optional(),
  defaultAgent: z.nativeEnum(Agent).optional(),
  deploymentUrl: z.string().url().max(500).nullable().optional(),
  claudeModels: claudeModelMapSchema.nullable().optional(),
});

export const ticketClarificationPolicySchema = z.nativeEnum(ClarificationPolicy).nullable();

export const ticketUpdateSchema = z.object({
  clarificationPolicy: ticketClarificationPolicySchema.optional(),
  version: z.number().int().optional(),
});
