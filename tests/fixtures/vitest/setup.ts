/**
 * Per-Test Setup for Vitest Integration Tests
 *
 * Provides TestContext with worker isolation, API client, and test helpers.
 *
 * Implementation of: specs/AIB-116-restructure-test-suite/contracts/test-context.ts
 */

import { beforeAll, afterAll } from 'vitest';
import { createAPIClient, type APIClient } from './api-client';
import { PROJECT_MAPPING, getProjectId } from './global-setup';
import {
  cleanupDatabase,
  ensureProjectExists,
  getPrismaClient,
  disconnectPrisma,
} from '../../helpers/db-cleanup';
import { createTestProject, createTestTicket } from '../../helpers/db-setup';

export interface TestContext {
  /** Isolated project ID for this worker (1, 2, 4, 5, 6, or 7) */
  projectId: number;

  /** Pre-configured API client with auth headers */
  api: APIClient;

  /**
   * Clean up all test data in the worker's project
   * Call in beforeEach or afterEach
   */
  cleanup: () => Promise<void>;

  /**
   * Create a test project with [e2e] prefix
   * Returns the created project
   */
  createProject: (name?: string) => Promise<{ id: number; key: string }>;

  /**
   * Create a test ticket in the worker's project
   * Returns the created ticket
   */
  createTicket: (data?: {
    title?: string;
    description?: string;
    stage?: string;
  }) => Promise<{ id: number; ticketKey: string }>;

  /**
   * Create a test user (for member/auth testing)
   * Returns the created user
   */
  createUser: (email?: string) => Promise<{ id: string; email: string }>;
}

// Store the worker's project ID (set in beforeAll)
let currentProjectId: number = PROJECT_MAPPING[0];

/**
 * Get the current test context
 * Call this in beforeEach to get fresh context for each test
 */
export async function getTestContext(): Promise<TestContext> {
  const projectId = currentProjectId;
  const api = createAPIClient();

  // Ensure project exists and is ready
  await ensureProjectExists(projectId);

  return {
    projectId,
    api,

    cleanup: async () => {
      await cleanupDatabase(projectId);
      await ensureProjectExists(projectId);
    },

    createProject: async (name?: string) => {
      const project = await createTestProject({
        name: name ?? '[e2e] Test Project',
      });
      return { id: project.id, key: project.key ?? '' };
    },

    createTicket: async (data?: { title?: string; description?: string; stage?: string }) => {
      const ticket = await createTestTicket(projectId, {
        title: data?.title ?? '[e2e] Test Ticket',
        description: data?.description ?? 'Test ticket description',
        stage: data?.stage ?? 'INBOX',
      });
      return { id: ticket.id, ticketKey: ticket.ticketKey ?? '' };
    },

    createUser: async (email?: string) => {
      const prisma = getPrismaClient();
      const userEmail = email ?? `test-${Date.now()}@project${projectId}.e2e.test`;
      const user = await prisma.user.upsert({
        where: { email: userEmail },
        update: {},
        create: {
          id: `user-${Date.now()}`,
          email: userEmail,
          name: 'Test User',
          emailVerified: new Date(),
          updatedAt: new Date(),
        },
      });
      return { id: user.id, email: user.email };
    },
  };
}

/**
 * Setup hook for Vitest integration tests
 * Initializes worker isolation based on pool ID
 */
beforeAll(async () => {
  // Get worker ID from environment (set by Vitest in poolOptions.forks)
  // Default to worker 0 if not set
  const workerId = parseInt(process.env.VITEST_POOL_ID ?? '0', 10);
  currentProjectId = getProjectId(workerId);

  // Ensure the worker's project exists
  await ensureProjectExists(currentProjectId);

  console.error(`✓ Worker ${workerId} using project ${currentProjectId}`);
});

/**
 * Cleanup hook for Vitest integration tests
 * Disconnects from database after all tests
 */
afterAll(async () => {
  await disconnectPrisma();
});

// Re-export for convenience
export { createAPIClient } from './api-client';
export type { APIClient, APIResponse, APIClientConfig } from './api-client';
