import { Ticket as PrismaTicket, ClarificationPolicy, Agent, WorkflowType, Prisma, JobStatus } from '@prisma/client';
import { Stage } from './stage-transitions';

/**
 * Re-export types
 */
export type { Stage, WorkflowType };
export type Ticket = PrismaTicket;

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
  agent: Agent | null;
  specifyModel: string | null;
  planModel: string | null;
  implementModel: string | null;
  quickImplModel: string | null;
  verifyModel: string | null;
  codexSpecifyModel: string | null;
  codexPlanModel: string | null;
  codexImplementModel: string | null;
  codexQuickImplModel: string | null;
  codexVerifyModel: string | null;
  workflowType: WorkflowType;
  attachments: Prisma.JsonValue;
  qualityScore: number | null;
  createdAt: string;
  updatedAt: string;
  project?: {
    clarificationPolicy: ClarificationPolicy;
    defaultAgent?: Agent;
    githubOwner?: string;
    githubRepo?: string;
  };
  jobs?: Array<{
    status: JobStatus;
    command: string;
    createdAt: Date;
  }>;
}

