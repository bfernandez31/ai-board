import { APIRequestContext } from '@playwright/test';

/**
 * Test helpers for transition API E2E tests
 */

/**
 * Transitions a ticket through multiple stages sequentially
 * @param request Playwright APIRequestContext
 * @param ticketId Ticket ID to transition
 * @param stages Array of stage names to transition through (e.g., ['SPECIFY', 'PLAN', 'BUILD'])
 */
export async function transitionThrough(
  request: APIRequestContext,
  ticketId: number,
  stages: string[]
): Promise<void> {
  for (const stage of stages) {
    await request.post(`/api/projects/1/tickets/${ticketId}/transition`, {
      data: { targetStage: stage },
    });
  }
}

/**
 * @deprecated Use cleanupDatabase() from db-cleanup.ts instead.
 * This function is redundant with cleanupDatabase() and should not be used.
 */
export async function cleanupTestData(): Promise<void> {
  throw new Error(
    'cleanupTestData() is deprecated. Use cleanupDatabase() from db-cleanup.ts instead. ' +
    'This ensures consistent cleanup behavior across all tests.'
  );
}
