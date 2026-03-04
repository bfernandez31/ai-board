/**
 * Zod validation schemas for project-related data
 */

import { z } from 'zod';

/**
 * Project key validation schema
 * - 3-6 characters
 * - Uppercase alphanumeric only (A-Z, 0-9)
 * - Automatically transforms to uppercase
 */
export const projectKeySchema = z
  .string()
  .min(3, 'Project key must be at least 3 characters')
  .max(6, 'Project key must be at most 6 characters')
  .regex(/^[A-Z0-9]{3,6}$/, 'Project key must be 3-6 uppercase alphanumeric characters (A-Z, 0-9)')
  .transform((val) => val.toUpperCase());

/**
 * Project creation schema
 * Includes optional key field for manual specification
 */
export const projectCreateSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Project name must be less than 100 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters'),
  githubOwner: z.string().min(1, 'GitHub owner is required').max(100, 'GitHub owner must be less than 100 characters'),
  githubRepo: z.string().min(1, 'GitHub repo is required').max(100, 'GitHub repo must be less than 100 characters'),
  deploymentUrl: z.string().url('Deployment URL must be a valid URL').max(500, 'Deployment URL must be less than 500 characters').nullable().optional(),
  key: projectKeySchema.optional(), // Optional: auto-generate if not provided
  clarificationPolicy: z.enum(['AUTO', 'CONSERVATIVE', 'PRAGMATIC', 'INTERACTIVE']).optional(),
  defaultAgent: z.enum(['CLAUDE', 'CODEX']).optional(),
});

/**
 * Project response schema
 * Includes key field in response
 */
export const projectResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  githubOwner: z.string(),
  githubRepo: z.string(),
  userId: z.string(),
  deploymentUrl: z.string().nullable(),
  key: projectKeySchema,
  clarificationPolicy: z.enum(['AUTO', 'CONSERVATIVE', 'PRAGMATIC', 'INTERACTIVE']),
  defaultAgent: z.enum(['CLAUDE', 'CODEX']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * TypeScript types inferred from schemas
 */
export type ProjectKey = z.infer<typeof projectKeySchema>;
export type ProjectCreate = z.infer<typeof projectCreateSchema>;
export type ProjectResponse = z.infer<typeof projectResponseSchema>;
