/**
 * Zod validation schemas for Comment API endpoints
 */

import { z } from 'zod';

/**
 * Regex pattern for validating mention markup: @[userId:displayName]
 */
const mentionMarkupRegex = /@\[([^:]+):([^\]]+)\]/g;

/**
 * Schema for creating a new comment
 * - Content must be 1-2000 characters (inclusive)
 * - Whitespace is trimmed before validation
 * - Empty strings and whitespace-only content rejected
 * - Mention markup format validated if @[ exists
 */
export const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Content must be at least 1 character')
    .max(2000, 'Content must be at most 2000 characters')
    .refine(
      (content) => {
        // Validate mention markup format if @[ exists
        if (!content.includes('@[')) return true;

        // Reset regex lastIndex for consistent matching
        mentionMarkupRegex.lastIndex = 0;
        const mentions = Array.from(content.matchAll(mentionMarkupRegex));

        // All @[ sequences must be valid mentions
        const atBracketCount = content.split('@[').length - 1;
        return atBracketCount === mentions.length;
      },
      { message: 'Invalid mention format' }
    ),
});

/**
 * Type inference from schema
 */
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
