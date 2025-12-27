/**
 * RTL Component Testing Helper Interfaces
 *
 * Feature: AIB-119-copy-of-testing
 * Date: 2025-12-27
 *
 * This file defines TypeScript interfaces for the test helper infrastructure.
 * Implementation files should import these types.
 */

import { ReactNode, ReactElement } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { RenderResult } from '@testing-library/react';
import type { MockInstance } from 'vitest';
import type { Ticket, Project, Job, Comment, User } from '@prisma/client';
import type { Stage, WorkflowType, JobStatus, ClarificationPolicy } from '@prisma/client';

// =============================================================================
// Test Wrapper Interfaces
// =============================================================================

/**
 * Props for the TestWrapper component
 */
export interface TestWrapperProps {
  /** React children to wrap with providers */
  children: ReactNode;
  /** Optional pre-configured QueryClient for testing specific cache states */
  queryClient?: QueryClient;
}

/**
 * Options for renderWithProviders function
 */
export interface RenderWithProvidersOptions {
  /** Pre-configured QueryClient */
  queryClient?: QueryClient;
  /** Initial pathname for usePathname mock */
  pathname?: string;
  /** Initial search params for useSearchParams mock */
  searchParams?: Record<string, string>;
}

/**
 * Extended render result with QueryClient access
 */
export interface RenderWithProvidersResult extends RenderResult {
  /** Access to QueryClient for cache inspection/manipulation */
  queryClient: QueryClient;
}

// =============================================================================
// Mock Data Factory Interfaces
// =============================================================================

/**
 * Options for creating mock Ticket data
 */
export interface MockTicketOptions extends Partial<Ticket> {
  /** Include jobs array for components that display job status */
  jobs?: MockJobOptions[];
}

/**
 * Options for creating mock Project data
 */
export interface MockProjectOptions extends Partial<Project> {
  /** Ticket count for ProjectCard display */
  ticketCount?: number;
  /** Last shipped ticket info */
  lastShippedTicket?: Partial<Ticket> | null;
}

/**
 * Options for creating mock Job data
 */
export interface MockJobOptions extends Partial<Job> {}

/**
 * Options for creating mock Comment data
 */
export interface MockCommentOptions extends Partial<Comment> {
  /** Author info for display */
  author?: MockUserOptions;
}

/**
 * Options for creating mock User data
 */
export interface MockUserOptions extends Partial<User> {}

// =============================================================================
// Mock Factory Function Signatures
// =============================================================================

/**
 * Creates a type-safe mock Ticket with default values
 */
export type CreateMockTicket = (overrides?: MockTicketOptions) => Ticket & {
  jobs?: Job[];
};

/**
 * Creates a type-safe mock Project with extended properties
 */
export type CreateMockProject = (overrides?: MockProjectOptions) => Project & {
  ticketCount?: number;
  lastShippedTicket?: Ticket | null;
};

/**
 * Creates a type-safe mock Job with default values
 */
export type CreateMockJob = (overrides?: MockJobOptions) => Job;

/**
 * Creates a type-safe mock Comment with author
 */
export type CreateMockComment = (overrides?: MockCommentOptions) => Comment & {
  author?: User;
};

/**
 * Creates a type-safe mock User with default values
 */
export type CreateMockUser = (overrides?: MockUserOptions) => User;

// =============================================================================
// Next.js Mock Interfaces
// =============================================================================

/**
 * Mock implementation for Next.js useRouter
 */
export interface MockRouter {
  push: MockInstance<[url: string], Promise<boolean>>;
  replace: MockInstance<[url: string], Promise<boolean>>;
  prefetch: MockInstance<[url: string], Promise<void>>;
  back: MockInstance<[], void>;
  forward: MockInstance<[], void>;
  refresh: MockInstance<[], void>;
}

/**
 * Creates a fresh mock router with reset spies
 */
export type CreateMockRouter = () => MockRouter;

// =============================================================================
// Component Test Helper Interfaces
// =============================================================================

/**
 * Configuration for setting up QueryClient in tests
 */
export interface TestQueryClientOptions {
  /** Disable retries (default: true for tests) */
  retry?: boolean;
  /** Garbage collection time (default: 0 for tests) */
  gcTime?: number;
  /** Stale time (default: 0 for tests) */
  staleTime?: number;
}

/**
 * Creates a QueryClient configured for testing
 */
export type CreateTestQueryClient = (options?: TestQueryClientOptions) => QueryClient;

// =============================================================================
// Re-export Prisma types for convenience
// =============================================================================

export type {
  Ticket,
  Project,
  Job,
  Comment,
  User,
  Stage,
  WorkflowType,
  JobStatus,
  ClarificationPolicy,
};
