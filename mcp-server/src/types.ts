/**
 * Ticket stage enum
 */
export type Stage = "INBOX" | "SPECIFY" | "PLAN" | "BUILD" | "VERIFY" | "SHIP";

/**
 * All valid stage values
 */
export const STAGES: Stage[] = ["INBOX", "SPECIFY", "PLAN", "BUILD", "VERIFY", "SHIP"];

/**
 * Workflow type enum
 */
export type WorkflowType = "FULL" | "QUICK" | "CLEAN";

/**
 * Clarification policy enum
 */
export type ClarificationPolicy = "AUTO" | "CONSERVATIVE" | "PRAGMATIC" | "INTERACTIVE";

/**
 * Project summary from GET /api/projects
 */
export interface ProjectSummary {
  id: number;
  key: string;
  name: string;
  description: string;
  githubOwner: string;
  githubRepo: string;
  deploymentUrl: string | null;
  updatedAt: string;
  ticketCount: number;
  lastShippedTicket: {
    id: number;
    ticketKey: string;
    title: string;
    updatedAt: string;
  } | null;
}

/**
 * Full project details from GET /api/projects/{id}
 */
export interface ProjectDetails {
  id: number;
  key: string;
  name: string;
  description: string;
  githubOwner: string;
  githubRepo: string;
  deploymentUrl: string | null;
  clarificationPolicy: ClarificationPolicy;
  createdAt: string;
  updatedAt: string;
}

/**
 * Ticket summary in stage groupings
 */
export interface TicketSummary {
  id: number;
  ticketNumber: number;
  ticketKey: string;
  title: string;
  description: string;
  stage: Stage;
  version: number;
  projectId: number;
  branch: string | null;
  workflowType: WorkflowType;
  createdAt: string;
  updatedAt: string;
}

/**
 * Tickets grouped by stage from GET /api/projects/{id}/tickets
 */
export interface TicketsByStage {
  INBOX: TicketSummary[];
  SPECIFY: TicketSummary[];
  PLAN: TicketSummary[];
  BUILD: TicketSummary[];
  VERIFY: TicketSummary[];
  SHIP: TicketSummary[];
}

/**
 * Full ticket details from GET /api/projects/{id}/tickets/{key}
 */
export interface TicketDetails {
  id: number;
  ticketNumber: number;
  ticketKey: string;
  title: string;
  description: string;
  stage: Stage;
  version: number;
  projectId: number;
  branch: string | null;
  autoMode: boolean;
  clarificationPolicy: string | null;
  workflowType: WorkflowType;
  attachments: unknown[];
  createdAt: string;
  updatedAt: string;
  project: {
    id: number;
    name: string;
    clarificationPolicy: string;
    githubOwner: string;
    githubRepo: string;
  };
}

/**
 * Ticket creation request body
 */
export interface CreateTicketRequest {
  title: string;
  description: string;
}

/**
 * Ticket creation response
 */
export interface CreateTicketResponse {
  id: number;
  ticketNumber: number;
  ticketKey: string;
  title: string;
  description: string;
  stage: "INBOX";
  version: number;
  projectId: number;
  branch: null;
  autoMode: boolean;
  attachments: unknown[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Stage transition request body
 */
export interface TransitionRequest {
  targetStage: Stage;
}

/**
 * Stage transition response
 */
export interface TransitionResponse {
  id: number;
  stage: Stage;
  workflowType: WorkflowType;
  branch: string | null;
  version: number;
  updatedAt: string;
  jobId?: number;
}
