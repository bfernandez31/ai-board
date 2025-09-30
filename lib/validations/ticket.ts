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

/**
 * Validation schema for creating a new ticket
 */
export const CreateTicketSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(500, 'Title too long'),
  description: z
    .string()
    .max(5000, 'Description too long')
    .optional(),
});

/**
 * Validation schema for a complete ticket entity
 */
export const TicketSchema = z.object({
  id: z.number().int().positive(),
  title: z
    .string()
    .min(1, 'Title is required')
    .max(500, 'Title too long'),
  description: z
    .string()
    .max(5000, 'Description too long')
    .nullable(),
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