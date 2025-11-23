import { Ticket as PrismaTicket, ClarificationPolicy, WorkflowType, Prisma, JobStatus } from '@prisma/client';
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
  previewUrl?: string | null;
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
  jobs?: Array<{
    status: JobStatus;
    command: string;
    createdAt: Date;
  }>;
}

