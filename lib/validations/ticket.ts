import { z } from 'zod';

/**
 * Project ID validation schema
 * Validates that projectId is a string representing a positive integer
 */
export const ProjectIdSchema = z.string().regex(/^\d+$/, {
  message: 'Invalid project ID',
});

/**
 * Stage enum validation schema
 */
export const StageSchema = z.enum([
  'INBOX',
  'SPECIFY',
  'PLAN',
  'BUILD',
  'VERIFY',
  'SHIP',
]);

/**
 * Regex pattern for allowed characters: letters, numbers, spaces, and extended punctuation
 * Allowed punctuation: . , ? ! - : ; ' " ( ) [ ] { } / \ @ # $ % & * + = _ ~ ` |
 * Must contain at least one non-whitespace character
 */
const ALLOWED_CHARS_PATTERN = /^(?=.*\S)[a-zA-Z0-9\s.,?!\-:;'"\(\)\[\]\{\}\/\\@#$%&*+=_~`|]+$/;

/**
 * Individual field schemas for real-time validation
 */
export const TitleFieldSchema = z
  .string()
  .min(1, 'Title is required')
  .max(100, 'Title must be 100 characters or less')
  .regex(
    ALLOWED_CHARS_PATTERN,
    'can only contain letters, numbers, spaces, and common special characters'
  );

export const DescriptionFieldSchema = z
  .string()
  .min(1, 'Description is required')
  .max(1000, 'Description must be 1000 characters or less')
  .regex(
    ALLOWED_CHARS_PATTERN,
    'can only contain letters, numbers, spaces, and common special characters'
  );

/**
 * Validation schema for creating a new ticket
 */
export const CreateTicketSchema = z
  .object({
    title: z.string().optional().default(''),
    description: z.string().optional().default(''),
  })
  .transform((data) => ({
    title: data.title.trim(),
    description: data.description.trim(),
  }))
  .refine((data) => data.title.length > 0, {
    message: 'Title is required',
    path: ['title'],
  })
  .refine((data) => data.title.length <= 100, {
    message: 'Title must be 100 characters or less',
    path: ['title'],
  })
  .refine((data) => ALLOWED_CHARS_PATTERN.test(data.title), {
    message: 'can only contain letters, numbers, spaces, and common special characters',
    path: ['title'],
  })
  .refine((data) => data.description.length > 0, {
    message: 'Description is required',
    path: ['description'],
  })
  .refine((data) => data.description.length <= 1000, {
    message: 'Description must be 1000 characters or less',
    path: ['description'],
  })
  .refine((data) => ALLOWED_CHARS_PATTERN.test(data.description), {
    message: 'can only contain letters, numbers, spaces, and common special characters',
    path: ['description'],
  });

/**
 * Validation schema for a complete ticket entity
 */
export const TicketSchema = z.object({
  id: z.number().int().positive(),
  title: z
    .string()
    .min(1, 'Title is required')
    .max(100, 'Title must be 100 characters or less'),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(1000, 'Description must be 1000 characters or less'),
  stage: StageSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Validation schemas for inline ticket editing (PATCH operations)
 */
export const titleSchema = z
  .string()
  .trim()
  .min(1, { message: 'Title cannot be empty' })
  .max(100, { message: 'Title must be 100 characters or less' });

export const descriptionSchema = z
  .string()
  .trim()
  .min(1, { message: 'Description cannot be empty' })
  .max(1000, { message: 'Description must be 1000 characters or less' });

export const versionSchema = z
  .number()
  .int({ message: 'Version must be an integer' })
  .positive({ message: 'Version must be positive' });

export const patchTicketSchema = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema.optional(),
    stage: StageSchema.optional(),
    branch: z.string().max(200).nullable().optional(),
    autoMode: z.boolean().optional(),
    version: versionSchema,
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.description !== undefined ||
      data.stage !== undefined ||
      data.branch !== undefined ||
      data.autoMode !== undefined,
    { message: 'At least one field must be provided' }
  );

export const updateBranchSchema = z.object({
  branch: z.string().max(200).nullable(),
});

/**
 * Validation schema for transition API requests
 * Validates targetStage is a valid Stage enum value
 */
export const TransitionRequestSchema = z.object({
  targetStage: StageSchema,
});

export const ticketResponseSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  description: z.string(),
  stage: z.enum(['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP']),
  version: z.number().int().positive(),
  projectId: z.number().int().positive(),
  branch: z.string().max(200).nullable(),
  autoMode: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * TypeScript types inferred from Zod schemas
 */
export type Stage = z.infer<typeof StageSchema>;
export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;
export type TicketValidation = z.infer<typeof TicketSchema>;
export type PatchTicketInput = z.infer<typeof patchTicketSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type TransitionRequest = z.infer<typeof TransitionRequestSchema>;
export type TicketResponse = z.infer<typeof ticketResponseSchema>;
