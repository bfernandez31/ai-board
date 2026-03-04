import type { WorkflowType, ClarificationPolicy, Agent, JobStatus, Prisma } from '@prisma/client';
import type { Stage } from '@/lib/stage-transitions';

export interface TicketWithVersion {
  id: number;
  ticketNumber: number;
  ticketKey: string;
  title: string;
  description: string | null;
  stage: Stage;
  projectId: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  branch: string | null;
  previewUrl?: string | null;
  autoMode: boolean;
  workflowType: WorkflowType;
  clarificationPolicy: ClarificationPolicy | null;
  agent: Agent | null;
  attachments: Prisma.JsonValue;
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

export type TicketsByStage = Record<Stage, TicketWithVersion[]>;

export interface JobStatusDto {
  id: number;
  ticketId: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  updatedAt: string;
}

export interface JobPollingResult {
  jobs: JobStatusDto[];
  hasActiveJobs: boolean;
  lastPollTime: number;
}

export interface TicketCreateVariables {
  title: string;
  description: string | null;
  stage: Stage;
  projectId: number;
  autoMode?: boolean;
  clarificationPolicy?: ClarificationPolicy | null;
}

export interface TicketUpdateVariables {
  ticketId: number;
  updates: Partial<Omit<TicketWithVersion, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>;
  version: number;
}

export interface TicketDeleteVariables {
  ticketId: number;
}

export interface StageTransitionVariables {
  ticketId: number;
  targetStage: Stage;
  version: number;
}

export interface OptimisticContext<T = unknown> {
  previousData: T;
  timestamp: number;
  queryKey: ReadonlyArray<unknown>;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  githubOwner: string | null;
  githubRepo: string | null;
  clarificationPolicy: ClarificationPolicy;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSettingsUpdateVariables {
  projectId: number;
  clarificationPolicy: ClarificationPolicy;
}

export type MutationSuccess<TData = unknown, TVariables = unknown, TContext = unknown> = {
  data: TData;
  variables: TVariables;
  context: TContext;
};

export type MutationError<TError = Error, TVariables = unknown, TContext = unknown> = {
  error: TError;
  variables: TVariables;
  context?: TContext;
};
