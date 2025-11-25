import { z } from 'zod';

/**
 * AI-BOARD comment creation request schema
 *
 * Used by GitHub workflow to post AI-BOARD response comments
 * via POST /api/projects/:projectId/tickets/:id/comments/ai-board
 */
export const aiBoardCommentRequestSchema = z.object({
  /** Comment content with mention of requester */
  content: z
    .string()
    .min(1, 'Comment content cannot be empty')
    .max(10000, 'Comment content cannot exceed 10000 characters'),

  /** AI-BOARD user ID (verified server-side) */
  userId: z.string().min(1, 'User ID is required'),
});

/**
 * AI-BOARD comment creation request type
 */
export type AIBoardCommentRequest = z.infer<
  typeof aiBoardCommentRequestSchema
>;

/**
 * AI-BOARD comment response schema
 *
 * Returns standard Comment object after successful creation
 */
export const aiBoardCommentResponseSchema = z.object({
  /** Comment ID */
  id: z.number(),

  /** Ticket ID */
  ticketId: z.number(),

  /** User ID (AI-BOARD) */
  userId: z.string(),

  /** Comment content */
  content: z.string(),

  /** Creation timestamp */
  createdAt: z.date(),

  /** Last update timestamp */
  updatedAt: z.date(),
});

/**
 * AI-BOARD comment response type
 */
export type AIBoardCommentResponse = z.infer<
  typeof aiBoardCommentResponseSchema
>;
