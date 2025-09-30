import { Stage, Ticket as PrismaTicket } from '@prisma/client';

/**
 * Re-export Prisma types
 */
export type { Stage };
export type Ticket = PrismaTicket;

/**
 * API Response Types
 */

/**
 * Response type for GET /api/tickets - tickets grouped by stage
 */
export interface TicketsByStage {
  IDLE: Ticket[];
  PLAN: Ticket[];
  BUILD: Ticket[];
  REVIEW: Ticket[];
  SHIPPED: Ticket[];
  ERRORED: Ticket[];
}

/**
 * Response type for POST /api/tickets - created ticket
 */
export interface CreateTicketResponse {
  id: number;
  title: string;
  description: string | null;
  stage: Stage;
  createdAt: string;
  updatedAt: string;
}

/**
 * Error response structure for API endpoints
 */
export interface ErrorResponse {
  error: string;
  code?: 'VALIDATION_ERROR' | 'DATABASE_ERROR' | 'INTERNAL_ERROR';
}

/**
 * UI Component Props
 */

/**
 * Props for TicketCard component
 */
export interface TicketCardProps {
  ticket: Ticket;
}

/**
 * Props for Column component
 */
export interface ColumnProps {
  stage: Stage;
  tickets: Ticket[];
}

/**
 * Props for Board component
 */
export interface BoardProps {
  ticketsByStage: TicketsByStage;
}