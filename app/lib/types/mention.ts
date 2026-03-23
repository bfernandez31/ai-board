// TypeScript types for user mentions in comments

export interface User {
  id: string;
  name: string | null;
  email: string;
}

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

export interface ParsedMention {
  userId: string;
  displayName: string;
  startIndex: number;
  endIndex: number;
}
