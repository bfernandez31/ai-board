import { z } from 'zod';

/**
 * Stage enum validation schema
 */
export const StageSchema = z.enum([
  'IDLE',
  'PLAN',
  'BUILD',
  'REVIEW',
  'SHIPPED',
  'ERRORED',
]);

// Pattern for alphanumeric + basic punctuation (periods, commas, hyphens, spaces, question marks, exclamation points)
const ALPHANUMERIC_PUNCTUATION = /^[a-zA-Z0-9\s.,?!\-]+$/;

/**
 * Validation schema for creating a new ticket
 */
export const CreateTicketSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(100, 'Title must be 100 characters or less')
    .regex(
      ALPHANUMERIC_PUNCTUATION,
      'Title can only contain letters, numbers, and basic punctuation (. , ? ! -)'
    )
    .trim(),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(1000, 'Description must be 1000 characters or less')
    .regex(
      ALPHANUMERIC_PUNCTUATION,
      'Description can only contain letters, numbers, and basic punctuation (. , ? ! -)'
    )
    .trim(),
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
 * TypeScript types inferred from Zod schemas
 */
export type Stage = z.infer<typeof StageSchema>;
export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;
export type TicketValidation = z.infer<typeof TicketSchema>;