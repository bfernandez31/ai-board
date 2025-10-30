import { z } from 'zod';
import { ClarificationPolicy } from '@prisma/client';

/**
 * Zod schema for project clarification policy validation
 * NOT NULL - cannot be null
 */
export const projectClarificationPolicySchema = z.nativeEnum(ClarificationPolicy);

/**
 * Zod schema for partial project updates including clarification policy
 */
export const projectUpdateSchema = z.object({
  clarificationPolicy: projectClarificationPolicySchema.or(z.undefined()).optional(),
  deploymentUrl: z.string().url().max(500).nullable().optional(),
}).partial();

/**
 * Zod schema for ticket clarification policy validation
 * NULLABLE - null allowed for reset to project default
 */
export const ticketClarificationPolicySchema = z.nativeEnum(ClarificationPolicy).nullable();

/**
 * Zod schema for partial ticket updates including clarification policy
 */
export const ticketUpdateSchema = z.object({
  clarificationPolicy: ticketClarificationPolicySchema.or(z.undefined()).optional(),
  version: z.number().int().or(z.undefined()).optional(),
}).partial();
