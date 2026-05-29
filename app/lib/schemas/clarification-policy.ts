import { z } from 'zod';
import { ClarificationPolicy, Agent } from '@prisma/client';
import { agentModelIdSchema } from '@/app/lib/schemas/model-config';

export const projectClarificationPolicySchema = z.nativeEnum(ClarificationPolicy);

export const projectUpdateSchema = z.object({
  clarificationPolicy: projectClarificationPolicySchema.optional(),
  defaultAgent: z.nativeEnum(Agent).optional(),
  deploymentUrl: z.string().url().max(500).nullable().optional(),
  specifyModel: agentModelIdSchema.nullable().optional(),
  planModel: agentModelIdSchema.nullable().optional(),
  implementModel: agentModelIdSchema.nullable().optional(),
  quickImplModel: agentModelIdSchema.nullable().optional(),
  verifyModel: agentModelIdSchema.nullable().optional(),
});

export const ticketClarificationPolicySchema = z.nativeEnum(ClarificationPolicy).nullable();

export const ticketUpdateSchema = z.object({
  clarificationPolicy: ticketClarificationPolicySchema.optional(),
  version: z.number().int().optional(),
});
