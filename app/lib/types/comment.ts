/**
 * Comment types for Ticket Comments feature
 * Generated from Prisma schema and API contracts
 */

import { User } from './mention';

/**
 * Comment with user information
 * Used in API responses (GET, POST) and frontend display
 */
export interface CommentWithUser {
  id: number;
  ticketId: number;
  userId: string;
  content: string;
  createdAt: string; // ISO 8601 datetime
  updatedAt: string; // ISO 8601 datetime
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

/**
 * Request body for creating a new comment
 * POST /api/projects/:projectId/tickets/:ticketId/comments
 */
export interface CreateCommentRequest {
  content: string; // 1-2000 characters
}

/**
 * Response from creating a new comment
 * Alias to CommentWithUser
 */
export type CreateCommentResponse = CommentWithUser;

/**
 * Response from listing comments
 * Array of comments with user information and mentioned users map
 */
export interface ListCommentsResponse {
  comments: CommentWithUser[];
  mentionedUsers: Record<string, User>;
}
