/**
 * Worker Isolation Helper for Playwright Tests
 *
 * Provides worker-specific project IDs to enable parallel test execution
 * without database conflicts.
 *
 * IMPORTANT: Project 3 is RESERVED for development and is skipped!
 */

import { test as base } from '@playwright/test';

/**
 * Get the project ID for the current worker
 * Playwright assigns workerIndex starting from 0
 *
 * Project Allocation:
 * - Worker 0 → Project 1 (E2E)
 * - Worker 1 → Project 2 (TE2)
 * - Worker 2 → Project 4 (TE4) - SKIP 3 (dev project)
 * - Worker 3 → Project 5 (TE5)
 * - Worker 4 → Project 6 (TE6)
 * - Worker 5 → Project 7 (TE7)
 *
 * @param workerIndex - The Playwright worker index (0-based)
 * @returns The project ID for this worker
 * @throws Error if workerIndex exceeds configured projects
 */
export function getWorkerProjectId(workerIndex: number): number {
  // Map workers to projects, skipping project 3 (development)
  const projectMapping = [1, 2, 4, 5, 6, 7];

  if (workerIndex >= projectMapping.length) {
    throw new Error(
      `Worker ${workerIndex} exceeds configured projects. ` +
      `Max workers: ${projectMapping.length}. ` +
      `Configure more projects in global-setup.ts to support more workers.`
    );
  }

  return projectMapping[workerIndex]!; // Safe: bounds check above ensures valid index
}

/**
 * Extended test fixture with worker-isolated projectId
 *
 * Usage:
 * ```typescript
 * import { test, expect } from './helpers/worker-isolation';
 *
 * test('should create ticket', async ({ page, request, projectId }) => {
 *   // projectId is automatically set based on worker
 *   const response = await request.post(`/api/projects/${projectId}/tickets`, {
 *     data: { title: '[e2e] Test Ticket' }
 *   });
 * });
 * ```
 */
export const test = base.extend<{ projectId: number }>({
  projectId: async ({}, use, testInfo) => {
    const workerIndex = testInfo.parallelIndex ?? 0; // Default to worker 0 if undefined
    const projectId = getWorkerProjectId(workerIndex);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(projectId);
  },
  // Dismiss the keyboard shortcuts dialog before each test so it doesn't block interactions
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      localStorage.setItem('shortcuts-hint-dismissed', 'true');
    });
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
  },
});

// Re-export Playwright types for convenience
export { expect, type Page, type Locator, type APIRequestContext } from '@playwright/test';
