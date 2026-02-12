export type Stage = "INBOX" | "SPECIFY" | "PLAN" | "BUILD" | "VERIFY" | "SHIP";

export const STAGES: Stage[] = ["INBOX", "SPECIFY", "PLAN", "BUILD", "VERIFY", "SHIP"];

export type WorkflowType = "FULL" | "QUICK" | "CLEAN";

export type ClarificationPolicy = "AUTO" | "CONSERVATIVE" | "PRAGMATIC" | "INTERACTIVE";

/** GET /api/projects */
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

/** GET /api/projects/{id} */
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

/** GET /api/projects/{id}/tickets — grouped by stage */
export interface TicketsByStage {
  INBOX: TicketSummary[];
  SPECIFY: TicketSummary[];
  PLAN: TicketSummary[];
  BUILD: TicketSummary[];
  VERIFY: TicketSummary[];
  SHIP: TicketSummary[];
}

/** GET /api/projects/{id}/tickets/{key} */
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

export interface CreateTicketRequest {
  title: string;
  description: string;
}

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

export interface TransitionRequest {
  targetStage: Stage;
}

export interface TransitionResponse {
  id: number;
  stage: Stage;
  workflowType: WorkflowType;
  branch: string | null;
  version: number;
  updatedAt: string;
  jobId?: number;
}
