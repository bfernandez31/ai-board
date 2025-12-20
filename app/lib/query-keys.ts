/**
 * Centralized query key factory for TanStack Query
 *
 * Benefits:
 * - Type-safe query keys with const assertions
 * - Hierarchical structure for smart cache invalidation
 * - Single source of truth for all query keys
 * - Prevents typos and inconsistencies
 *
 * Hierarchy example:
 * - ['projects'] invalidates ALL project-related queries
 * - ['projects', 1] invalidates specific project AND its children
 * - ['projects', 1, 'tickets'] invalidates only tickets for project 1
 */
export const queryKeys = {
  /**
   * Project-related query keys
   */
  projects: {
    /**
     * All projects list
     */
    all: ['projects'] as const,

    /**
     * Single project details
     */
    detail: (id: number) => ['projects', id] as const,

    /**
     * All tickets for a project
     */
    tickets: (id: number) => ['projects', id, 'tickets'] as const,

    /**
     * Single ticket within a project
     */
    ticket: (projectId: number, ticketId: number) =>
      ['projects', projectId, 'tickets', ticketId] as const,

    /**
     * Job status polling for a project
     */
    jobsStatus: (id: number) => ['projects', id, 'jobs', 'status'] as const,

    /**
     * Project settings
     */
    settings: (id: number) => ['projects', id, 'settings'] as const,

    /**
     * Documentation content for a specific ticket and document type
     */
    documentation: (projectId: number, ticketId: number, docType: 'spec' | 'plan' | 'tasks' | 'summary') =>
      ['projects', projectId, 'tickets', ticketId, 'documentation', docType] as const,

    /**
     * Documentation commit history for a specific ticket and document type
     */
    documentationHistory: (projectId: number, ticketId: number, docType: 'spec' | 'plan' | 'tasks' | 'summary') =>
      ['projects', projectId, 'tickets', ticketId, 'documentation', docType, 'history'] as const,

    /**
     * Project members for autocomplete dropdown
     */
    members: (id: number) => ['projects', id, 'members'] as const,

    /**
     * Conversation timeline for a specific ticket
     * Includes both comments and job lifecycle events merged chronologically
     */
    timeline: (projectId: number, ticketId: number) =>
      ['projects', projectId, 'tickets', ticketId, 'timeline'] as const,

    /**
     * Constitution content for a project
     */
    constitution: (projectId: number) =>
      ['projects', projectId, 'constitution'] as const,

    /**
     * Constitution commit history for a project
     */
    constitutionHistory: (projectId: number) =>
      ['projects', projectId, 'constitution', 'history'] as const,

    /**
     * Constitution diff for a specific commit
     */
    constitutionDiff: (projectId: number, sha: string) =>
      ['projects', projectId, 'constitution', 'diff', sha] as const,

    /**
     * Ticket search within a project
     */
    ticketSearch: (projectId: number, query: string) =>
      ['projects', projectId, 'tickets', 'search', query] as const,
  },

  /**
   * Comment-related query keys
   */
  comments: {
    /**
     * All comments for a specific ticket
     */
    list: (ticketId: number) => ['comments', ticketId] as const,
  },

  /**
   * Analytics-related query keys
   */
  analytics: {
    /**
     * All analytics data for a project
     */
    all: (projectId: number) => ['analytics', projectId] as const,

    /**
     * Analytics data for specific time range
     */
    data: (projectId: number, range: string) => ['analytics', projectId, range] as const,
  },

  /**
   * User-related query keys
   */
  users: {
    /**
     * All users list
     */
    all: ['users'] as const,

    /**
     * Current authenticated user
     */
    current: ['users', 'current'] as const,

    /**
     * Single user details
     */
    detail: (id: string) => ['users', id] as const,
  },
} as const;

/**
 * Type helper to extract query key types
 */
export type QueryKeys = typeof queryKeys;
