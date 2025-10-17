import type { Stage, WorkflowType, ClarificationPolicy } from '@prisma/client';

/**
 * Query-specific type definitions for TanStack Query
 *
 * These types extend the existing API types with query-specific structures
 * for optimistic updates, cache management, and mutation variables.
 */

/**
 * Ticket with version for optimistic concurrency control
 * Matches the existing TicketWithVersion interface from API
 */
export interface TicketWithVersion {
  id: number;
  title: string;
  description: string | null;
  stage: Stage;
  projectId: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  branch: string | null;
  autoMode: boolean;
  workflowType: WorkflowType;
  clarificationPolicy: ClarificationPolicy | null;
}

/**
 * Tickets grouped by stage for board display
 * Used by useTicketsByStage query hook
 */
export type TicketsByStage = Record<Stage, TicketWithVersion[]>;

/**
 * Job status DTO for polling endpoint
 * Matches the existing JobStatusDto from API
 */
export interface JobStatusDto {
  id: number;
  ticketId: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  updatedAt: string;
}

/**
 * Job polling result with computed state
 */
export interface JobPollingResult {
  jobs: JobStatusDto[];
  hasActiveJobs: boolean;
  lastPollTime: number;
}

/**
 * Variables for ticket creation mutation
 */
export interface TicketCreateVariables {
  title: string;
  description: string | null;
  stage: Stage;
  projectId: number;
  autoMode?: boolean;
  clarificationPolicy?: ClarificationPolicy | null;
}

/**
 * Variables for ticket update mutation
 */
export interface TicketUpdateVariables {
  ticketId: number;
  updates: Partial<Omit<TicketWithVersion, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>;
  version: number;
}

/**
 * Variables for ticket deletion mutation
 */
export interface TicketDeleteVariables {
  ticketId: number;
}

/**
 * Variables for stage transition mutation (drag-and-drop)
 */
export interface StageTransitionVariables {
  ticketId: number;
  targetStage: Stage;
  version: number;
}

/**
 * Optimistic update context for rollback on errors
 * Generic type parameter T represents the cached data type
 */
export interface OptimisticContext<T = unknown> {
  previousData: T;
  timestamp: number;
  queryKey: ReadonlyArray<unknown>;
}

/**
 * Project with clarification policy
 * Matches existing Project type from API
 */
export interface Project {
  id: number;
  name: string;
  description: string | null;
  githubOwner: string | null;
  githubRepo: string | null;
  clarificationPolicy: ClarificationPolicy;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Variables for project settings update mutation
 */
export interface ProjectSettingsUpdateVariables {
  projectId: number;
  clarificationPolicy: ClarificationPolicy;
}

/**
 * Helper type to extract the success data type from a mutation
 */
export type MutationSuccess<TData = unknown, TVariables = unknown, TContext = unknown> = {
  data: TData;
  variables: TVariables;
  context: TContext;
};

/**
 * Helper type to extract the error type from a mutation
 */
export type MutationError<TError = Error, TVariables = unknown, TContext = unknown> = {
  error: TError;
  variables: TVariables;
  context?: TContext;
};
