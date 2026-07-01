import type { TicketAttachment } from '@/app/lib/types/ticket';
import type { TicketJobWithTelemetry } from '@/lib/types/job-types';
import { ClarificationPolicy, Agent } from '@prisma/client';

/**
 * Ticket type for modal (compatible with both Prisma Ticket and TicketWithVersion)
 */
export interface TicketData {
  id: number;
  ticketNumber: number;
  ticketKey: string;
  title: string;
  description: string | null;
  stage: string;
  version: number;
  projectId: number;
  branch: string | null;
  autoMode: boolean;
  clarificationPolicy: ClarificationPolicy | null;
  agent?: Agent | null;
  tokenSaving?: boolean | null;
  specifyModel?: string | null;
  planModel?: string | null;
  implementModel?: string | null;
  quickImplModel?: string | null;
  verifyModel?: string | null;
  codexSpecifyModel?: string | null;
  codexPlanModel?: string | null;
  codexImplementModel?: string | null;
  codexQuickImplModel?: string | null;
  codexVerifyModel?: string | null;
  workflowType: 'FULL' | 'QUICK' | 'CLEAN';
  attachments?: TicketAttachment[] | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  project?: {
    clarificationPolicy: ClarificationPolicy;
    defaultAgent?: Agent;
    tokenSaving?: boolean;
    githubOwner?: string;
    githubRepo?: string;
  };
}

/**
 * Job data passed from parent for real-time updates
 */
export interface TicketJob {
  id: number;
  command: string;
  status: string;
}

/**
 * Props interface for TicketDetailModal component
 */
export interface TicketDetailModalProps {
  /** The ticket to display in the modal. When null, modal should not render content. */
  ticket: TicketData | null;

  /** Controls the visibility of the modal dialog. */
  open: boolean;

  /** Callback fired when the modal requests to be closed (via close button, ESC, or overlay click). */
  onOpenChange: (open: boolean) => void;

  /** Callback fired when ticket is updated successfully to refresh parent state. */
  onUpdate?: (ticket: TicketData) => void;

  /** The project ID for project-scoped API calls */
  projectId: number;

  /** Optional initial tab to display when modal opens. Defaults to 'details'. */
  initialTab?: 'details' | 'comments' | 'files' | 'stats';

  /** Jobs for this ticket, passed from parent for real-time polling updates */
  jobs?: TicketJob[];

  /** Full job data with telemetry fields for Stats tab display */
  fullJobs?: TicketJobWithTelemetry[];
}

export type CanonicalStage =
  | 'inbox'
  | 'specify'
  | 'plan'
  | 'build'
  | 'verify'
  | 'ship';
