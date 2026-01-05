// TypeScript types for user mentions in comments

export interface User {
  id: string;
  name: string | null;
  email: string;
}

// Re-export search types for autocomplete
export type { SearchResult as TicketSearchResult } from './search';

// Re-export AI-BOARD command type for autocomplete
export type { AIBoardCommand } from '../data/ai-board-commands';

export interface ProjectMember extends User {
  // No additional fields for MVP
}

export interface Comment {
  id: number;
  ticketId: number;
  userId: string;
  content: string; // May contain mention markup
  createdAt: string;
  updatedAt: string;
}

export interface CommentWithAuthor extends Comment {
  user: User; // Comment author
}

export interface ParsedMention {
  userId: string;
  displayName: string;
  startIndex: number;
  endIndex: number;
}

// API request/response types
export interface GetProjectMembersResponse {
  members: ProjectMember[];
}

export interface CreateCommentRequest {
  content: string;
}

export interface CreateCommentResponse extends Comment {}

export interface GetCommentsResponse {
  comments: CommentWithAuthor[];
  mentionedUsers: Record<string, User>;
}

// UI component types
export interface MentionSegment {
  type: 'mention';
  userId: string;
  displayName: string;
  isDeleted: boolean;
}

export interface TextSegment {
  type: 'text';
  content: string;
}

export type CommentSegment = MentionSegment | TextSegment;
