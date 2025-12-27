/**
 * Mock Data Factories for RTL Component Tests
 *
 * Type-safe factory functions that return Prisma-typed entities.
 * All factories provide sensible defaults and allow partial overrides.
 */

import type {
  Ticket,
  Project,
  Job,
  Comment,
  User,
  Stage,
  WorkflowType,
  JobStatus,
  JobCommand,
  ClarificationPolicy,
} from '@prisma/client';
import type { TicketWithVersion } from '@/lib/types';

// =============================================================================
// Ticket Factory
// =============================================================================

interface MockTicketOptions extends Partial<Ticket> {
  /** Include jobs array for components that display job status */
  jobs?: Job[];
}

/**
 * Creates a type-safe mock Ticket with default values.
 * All fields are populated with valid defaults.
 */
export function createMockTicket(
  overrides?: MockTicketOptions
): Ticket & { jobs?: Job[] } {
  const now = new Date();
  const { jobs, ...ticketOverrides } = overrides ?? {};

  const ticket: Ticket = {
    id: 1,
    ticketKey: 'ABC-1',
    title: 'Test Ticket',
    description: null,
    stage: 'INBOX' as Stage,
    branch: null,
    workflowType: 'FULL' as WorkflowType,
    previewUrl: null,
    projectId: 1,
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...ticketOverrides,
  };

  if (jobs !== undefined) {
    return { ...ticket, jobs };
  }

  return ticket;
}

// =============================================================================
// TicketWithVersion Factory (for board components)
// =============================================================================

interface MockTicketWithVersionOptions extends Partial<TicketWithVersion> {}

/**
 * Creates a type-safe mock TicketWithVersion for board component tests.
 * This is the type used by TicketCard, StageColumn, etc.
 */
export function createMockTicketWithVersion(
  overrides?: MockTicketWithVersionOptions
): TicketWithVersion {
  const now = new Date().toISOString();

  return {
    id: 1,
    ticketNumber: 1,
    ticketKey: 'ABC-1',
    title: 'Test Ticket',
    description: null,
    stage: 'INBOX' as Stage,
    version: 1,
    projectId: 1,
    branch: null,
    previewUrl: null,
    autoMode: true,
    clarificationPolicy: null,
    workflowType: 'FULL' as WorkflowType,
    attachments: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// =============================================================================
// Project Factory
// =============================================================================

interface MockProjectOptions extends Partial<Project> {
  /** Ticket count for ProjectCard display */
  ticketCount?: number;
  /** Last shipped ticket info */
  lastShippedTicket?: Partial<Ticket> | null;
}

/**
 * Creates a type-safe mock Project with default values.
 */
export function createMockProject(
  overrides?: MockProjectOptions
): Project & { ticketCount?: number; lastShippedTicket?: Ticket | null } {
  const now = new Date();
  const { ticketCount, lastShippedTicket, ...projectOverrides } =
    overrides ?? {};

  const project: Project = {
    id: 1,
    key: 'ABC',
    name: 'Test Project',
    githubOwner: 'test-owner',
    githubRepo: 'test-repo',
    deploymentUrl: null,
    clarificationPolicy: 'AUTO' as ClarificationPolicy,
    userId: 'user-1',
    createdAt: now,
    updatedAt: now,
    ...projectOverrides,
  };

  const result: Project & {
    ticketCount?: number;
    lastShippedTicket?: Ticket | null;
  } = project;

  if (ticketCount !== undefined) {
    result.ticketCount = ticketCount;
  }

  if (lastShippedTicket !== undefined) {
    result.lastShippedTicket = lastShippedTicket
      ? createMockTicket(lastShippedTicket)
      : null;
  }

  return result;
}

// =============================================================================
// Job Factory
// =============================================================================

/**
 * Creates a type-safe mock Job with default values.
 */
export function createMockJob(overrides?: Partial<Job>): Job {
  const now = new Date();

  return {
    id: 1,
    ticketId: 1,
    command: 'specify' as JobCommand,
    status: 'COMPLETED' as JobStatus,
    workflowRunId: null,
    workflowToken: null,
    startedAt: now,
    completedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// =============================================================================
// Comment Factory
// =============================================================================

interface MockCommentOptions extends Partial<Comment> {
  /** Author info for display */
  author?: MockUserOptions;
}

interface MockUserOptions extends Partial<User> {}

/**
 * Creates a type-safe mock Comment with default values.
 */
export function createMockComment(
  overrides?: MockCommentOptions
): Comment & { author?: User } {
  const now = new Date();
  const { author, ...commentOverrides } = overrides ?? {};

  const comment: Comment = {
    id: 1,
    ticketId: 1,
    content: 'Test comment content',
    authorId: 'user-1',
    createdAt: now,
    updatedAt: now,
    ...commentOverrides,
  };

  if (author !== undefined) {
    return { ...comment, author: createMockUser(author) };
  }

  return comment;
}

// =============================================================================
// User Factory
// =============================================================================

/**
 * Creates a type-safe mock User with default values.
 */
export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    emailVerified: null,
    image: null,
    ...overrides,
  };
}
