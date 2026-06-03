import { z } from 'zod';
import { Agent, ClarificationPolicy, TokenSavingOverride } from '@prisma/client';
import { claudeModelIdSchema, codexModelIdSchema } from '@/app/lib/schemas/model-config';

export const projectClarificationPolicySchema = z.nativeEnum(ClarificationPolicy);

export const projectUpdateSchema = z.object({
  clarificationPolicy: projectClarificationPolicySchema.optional(),
  defaultAgent: z.nativeEnum(Agent).optional(),
  deploymentUrl: z.string().url().max(500).nullable().optional(),
  specifyModel: claudeModelIdSchema.nullable().optional(),
  planModel: claudeModelIdSchema.nullable().optional(),
  implementModel: claudeModelIdSchema.nullable().optional(),
  quickImplModel: claudeModelIdSchema.nullable().optional(),
  verifyModel: claudeModelIdSchema.nullable().optional(),
  codexSpecifyModel: codexModelIdSchema.nullable().optional(),
  codexPlanModel: codexModelIdSchema.nullable().optional(),
  codexImplementModel: codexModelIdSchema.nullable().optional(),
  codexQuickImplModel: codexModelIdSchema.nullable().optional(),
  codexVerifyModel: codexModelIdSchema.nullable().optional(),
  tokenSavingEnabled: z.boolean().optional(),
});

export const ticketClarificationPolicySchema = z.nativeEnum(ClarificationPolicy).nullable();
export const ticketTokenSavingOverrideSchema = z.nativeEnum(TokenSavingOverride).nullable();

export const ticketUpdateSchema = z.object({
  clarificationPolicy: ticketClarificationPolicySchema.optional(),
  tokenSavingOverride: ticketTokenSavingOverrideSchema.optional(),
  version: z.number().int().optional(),
});
