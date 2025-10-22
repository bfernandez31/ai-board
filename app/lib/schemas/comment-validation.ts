/**
 * Zod validation schemas for Comment API endpoints
 */

import { z } from 'zod';

/**
 * Schema for creating a new comment
 * - Content must be 1-2000 characters (inclusive)
 * - Whitespace is trimmed before validation
 * - Empty strings and whitespace-only content rejected
 */
export const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Content must be at least 1 character')
    .max(2000, 'Content must be at most 2000 characters'),
});

/**
 * Type inference from schema
 */
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
