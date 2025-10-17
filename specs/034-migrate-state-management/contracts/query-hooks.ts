/**
 * TanStack Query Hook Contracts
 *
 * This file defines the TypeScript contracts for all TanStack Query hooks
 * used in the ai-board application. These are client-side contracts that
 * wrap existing API endpoints with caching and state management.
 */

import type { UseQueryOptions, UseMutationOptions, QueryKey } from '@tanstack/react-query';
import type {
  TicketWithVersion,
  JobStatusDto,
  Project,
  Stage,
  WorkflowType,
  ClarificationPolicy,
  JobStatus,
} from '@/lib/types';

// ============================================================================
// Query Key Factory
// ============================================================================

export const queryKeys = {
  projects: {
    all: ['projects'] as const,
    detail: (id: number) => ['projects', id] as const,
    tickets: (id: number) => ['projects', id, 'tickets'] as const,
    ticket: (projectId: number, ticketId: number) =>
      ['projects', projectId, 'tickets', ticketId] as const,
    jobs: (id: number) => ['projects', id, 'jobs'] as const,
    jobsStatus: (id: number) => ['projects', id, 'jobs', 'status'] as const,
    settings: (id: number) => ['projects', id, 'settings'] as const,
  },
  users: {
    all: ['users'] as const,
    current: ['users', 'current'] as const,
    detail: (id: string) => ['users', id] as const,
  },
} as const;

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetch all tickets for a project
 */
export interface UseProjectTicketsOptions {
  projectId: number;
  options?: Omit<UseQueryOptions<TicketWithVersion[]>, 'queryKey' | 'queryFn'>;
}

export interface UseProjectTicketsReturn {
  data: TicketWithVersion[] | undefined;
  error: Error | null;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => void;
}

/**
 * Fetch job status for polling
 */
export interface UseJobPollingOptions {
  projectId: number;
  pollingInterval?: number; // Default: 2000ms
  options?: Omit<UseQueryOptions<JobStatusDto[]>, 'queryKey' | 'queryFn'>;
}

export interface UseJobPollingReturn {
  jobs: JobStatusDto[];
  isPolling: boolean;
  lastPollTime: number | null;
  errorCount: number;
  error: Error | null;
}

/**
 * Fetch project details
 */
export interface UseProjectDetailsOptions {
  projectId: number;
  options?: Omit<UseQueryOptions<Project>, 'queryKey' | 'queryFn'>;
}

export interface UseProjectDetailsReturn {
  data: Project | undefined;
  error: Error | null;
  isLoading: boolean;
  refetch: () => void;
}

/**
 * Fetch tickets grouped by stage
 */
export type TicketsByStage = Record<Stage, TicketWithVersion[]>;

export interface UseTicketsByStageOptions {
  projectId: number;
  options?: Omit<UseQueryOptions<TicketsByStage>, 'queryKey' | 'queryFn'>;
}

export interface UseTicketsByStageReturn {
  data: TicketsByStage | undefined;
  error: Error | null;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => void;
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Create a new ticket
 */
export interface CreateTicketVariables {
  title: string;
  description: string | null;
  stage: Stage;
  projectId: number;
  autoMode?: boolean;
  clarificationPolicy?: ClarificationPolicy | null;
}

export interface UseCreateTicketOptions {
  options?: Omit<
    UseMutationOptions<TicketWithVersion, Error, CreateTicketVariables>,
    'mutationFn'
  >;
}

/**
 * Update an existing ticket
 */
export interface UpdateTicketVariables {
  projectId: number;
  ticketId: number;
  updates: {
    title?: string;
    description?: string | null;
    stage?: Stage;
    branch?: string | null;
    autoMode?: boolean;
    version: number; // Required for optimistic concurrency control
  };
}

export interface UseUpdateTicketOptions {
  options?: Omit<
    UseMutationOptions<TicketWithVersion, Error, UpdateTicketVariables>,
    'mutationFn'
  >;
}

/**
 * Stage transition mutation (with workflow dispatch)
 */
export interface StageTransitionVariables {
  projectId: number;
  ticketId: number;
  targetStage: Stage;
  version: number;
}

export interface StageTransitionResponse {
  ticket: TicketWithVersion;
  jobId?: number; // Present if workflow was dispatched
}

export interface UseStageTransitionOptions {
  options?: Omit<
    UseMutationOptions<StageTransitionResponse, Error, StageTransitionVariables>,
    'mutationFn'
  >;
}

/**
 * Delete a ticket
 */
export interface DeleteTicketVariables {
  projectId: number;
  ticketId: number;
}

export interface UseDeleteTicketOptions {
  options?: Omit<
    UseMutationOptions<void, Error, DeleteTicketVariables>,
    'mutationFn'
  >;
}

/**
 * Update project settings
 */
export interface UpdateProjectSettingsVariables {
  projectId: number;
  settings: {
    name?: string;
    description?: string | null;
    clarificationPolicy?: ClarificationPolicy;
  };
}

export interface UseUpdateProjectSettingsOptions {
  options?: Omit<
    UseMutationOptions<Project, Error, UpdateProjectSettingsVariables>,
    'mutationFn'
  >;
}

// ============================================================================
// Optimistic Update Contexts
// ============================================================================

/**
 * Context for ticket mutations to enable rollback
 */
export interface TicketMutationContext {
  previousTickets?: TicketWithVersion[];
  previousTicketsByStage?: TicketsByStage;
  optimisticTicket?: TicketWithVersion;
  timestamp: number;
}

/**
 * Context for project settings mutations
 */
export interface ProjectSettingsMutationContext {
  previousSettings?: Project;
  timestamp: number;
}

// ============================================================================
// Query Invalidation Helpers
// ============================================================================

export interface InvalidationPattern {
  queryKey: QueryKey;
  exact?: boolean;
  refetchType?: 'active' | 'inactive' | 'all';
}

/**
 * Standard invalidation patterns after mutations
 */
export const invalidationPatterns = {
  afterTicketCreate: (projectId: number): InvalidationPattern[] => [
    { queryKey: queryKeys.projects.tickets(projectId) },
  ],

  afterTicketUpdate: (projectId: number, ticketId: number): InvalidationPattern[] => [
    { queryKey: queryKeys.projects.tickets(projectId) },
    { queryKey: queryKeys.projects.ticket(projectId, ticketId), exact: true },
  ],

  afterTicketDelete: (projectId: number): InvalidationPattern[] => [
    { queryKey: queryKeys.projects.tickets(projectId) },
  ],

  afterStageTransition: (projectId: number): InvalidationPattern[] => [
    { queryKey: queryKeys.projects.tickets(projectId) },
    { queryKey: queryKeys.projects.jobsStatus(projectId) },
  ],

  afterProjectSettingsUpdate: (projectId: number): InvalidationPattern[] => [
    { queryKey: queryKeys.projects.detail(projectId), exact: true },
    { queryKey: queryKeys.projects.settings(projectId), exact: true },
  ],
} as const;

// ============================================================================
// Error Types
// ============================================================================

export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class OptimisticUpdateError extends Error {
  constructor(
    message: string,
    public originalError: Error,
    public context?: unknown
  ) {
    super(message);
    this.name = 'OptimisticUpdateError';
  }
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Extract the data type from a query hook return
 */
export type ExtractQueryData<T> = T extends { data: infer D } ? D : never;

/**
 * Type-safe query options builder
 */
export function buildQueryOptions<TData>(
  key: QueryKey,
  fn: () => Promise<TData>,
  options?: Partial<UseQueryOptions<TData>>
): UseQueryOptions<TData> {
  return {
    queryKey: key,
    queryFn: fn,
    ...options,
  };
}

/**
 * Type-safe mutation options builder
 */
export function buildMutationOptions<TData, TVariables, TContext = unknown>(
  fn: (variables: TVariables) => Promise<TData>,
  options?: Partial<UseMutationOptions<TData, Error, TVariables, TContext>>
): UseMutationOptions<TData, Error, TVariables, TContext> {
  return {
    mutationFn: fn,
    ...options,
  };
}