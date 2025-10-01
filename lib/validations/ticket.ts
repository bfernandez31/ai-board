import { z } from 'zod';

/**
 * Stage enum validation schema
 */
export const StageSchema = z.enum([
  'INBOX',
  'PLAN',
  'BUILD',
  'VERIFY',
  'SHIP',
]);

/**
 * Regex pattern for allowed characters: letters, numbers, spaces, and basic punctuation
 * Allowed punctuation: . , ? ! -
 */
const ALLOWED_CHARS_PATTERN = /^[a-zA-Z0-9\s.,?!\-]+$/;

/**
 * Individual field schemas for real-time validation
 */
export const TitleFieldSchema = z
  .string()
  .min(1, 'Title is required')
  .max(100, 'Title must be 100 characters or less')
  .regex(
    ALLOWED_CHARS_PATTERN,
    'can only contain letters, numbers, and basic punctuation'
  );

export const DescriptionFieldSchema = z
  .string()
  .min(1, 'Description is required')
  .max(1000, 'Description must be 1000 characters or less')
  .regex(
    ALLOWED_CHARS_PATTERN,
    'can only contain letters, numbers, and basic punctuation'
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
    message: 'can only contain letters, numbers, and basic punctuation',
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
    message: 'can only contain letters, numbers, and basic punctuation',
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
 * TypeScript types inferred from Zod schemas
 */
export type Stage = z.infer<typeof StageSchema>;
export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;
export type TicketValidation = z.infer<typeof TicketSchema>;