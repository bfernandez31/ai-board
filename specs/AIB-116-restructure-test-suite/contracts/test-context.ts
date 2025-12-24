/**
 * Test Context Contract for Vitest Integration Tests
 *
 * This interface defines the test context available in each test.
 * Implementation: tests/fixtures/vitest/setup.ts
 */

import type { APIClient } from './api-client';

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

/**
 * Worker isolation configuration
 */
export interface WorkerIsolation {
  /** Available project IDs for workers (skip 3 for development) */
  projectMapping: readonly [1, 2, 4, 5, 6, 7];

  /** Get project ID for a worker index */
  getProjectId: (workerId: number) => number;

  /** Maximum concurrent workers supported */
  maxWorkers: 6;
}

/**
 * Global setup function signature
 * Called once before all tests in a worker
 */
export type GlobalSetupFn = (config: {
  workerId: number;
}) => Promise<void> | void;

/**
 * Per-test setup function signature
 * Called before each test
 */
export type TestSetupFn = () => Promise<TestContext>;
