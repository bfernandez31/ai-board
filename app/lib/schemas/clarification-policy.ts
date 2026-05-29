import { z } from 'zod';
import { ClarificationPolicy, Agent } from '@prisma/client';
import { anyModelIdSchema } from '@/app/lib/schemas/model-config';

export const projectClarificationPolicySchema = z.nativeEnum(ClarificationPolicy);

export const projectUpdateSchema = z.object({
  clarificationPolicy: projectClarificationPolicySchema.optional(),
  defaultAgent: z.nativeEnum(Agent).optional(),
  deploymentUrl: z.string().url().max(500).nullable().optional(),
  specifyModel: anyModelIdSchema.nullable().optional(),
  planModel: anyModelIdSchema.nullable().optional(),
  implementModel: anyModelIdSchema.nullable().optional(),
  quickImplModel: anyModelIdSchema.nullable().optional(),
  verifyModel: anyModelIdSchema.nullable().optional(),
});

export const ticketClarificationPolicySchema = z.nativeEnum(ClarificationPolicy).nullable();

export const ticketUpdateSchema = z.object({
  clarificationPolicy: ticketClarificationPolicySchema.optional(),
  version: z.number().int().optional(),
});
