import { Ticket as PrismaTicket, ClarificationPolicy, WorkflowType, Prisma } from '@prisma/client';
import { Stage } from './stage-transitions';

/**
 * Re-export types
 */
export type { Stage, WorkflowType };
export type Ticket = PrismaTicket;

/**
 * API Response Types
 */

/**
 * Response type for GET /api/tickets - tickets grouped by stage
 */
export interface TicketsByStage {
  INBOX: Ticket[];
  PLAN: Ticket[];
  BUILD: Ticket[];
  VERIFY: Ticket[];
  SHIP: Ticket[];
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

/**
 * Drag-and-Drop Types
 */

/**
 * Ticket with version field for optimistic concurrency control
 */
export interface TicketWithVersion {
  id: number;
  ticketNumber: number;
  ticketKey: string;
  title: string;
  description: string | null;
  stage: Stage;
  version: number;
  projectId: number;
  branch: string | null;
  autoMode: boolean;
  clarificationPolicy: ClarificationPolicy | null;
  workflowType: WorkflowType;
  attachments: Prisma.JsonValue;
  createdAt: string;
  updatedAt: string;
  project?: {
    clarificationPolicy: ClarificationPolicy;
    githubOwner?: string;
    githubRepo?: string;
  };
}

/**
 * Request body for updating ticket stage
 */
export interface UpdateStageRequest {
  stage: Stage;
  version: number;
}

/**
 * Response body for successful stage update
 */
export interface UpdateStageResponse {
  id: number;
  stage: Stage;
  version: number;
  updatedAt: string;
}

/**
 * Error response when ticket was modified by another user (409 Conflict)
 */
export interface StageConflictError {
  error: string;
  currentStage: Stage;
  currentVersion: number;
}
