import { APIRequestContext } from '@playwright/test';
import { getPrismaClient } from './db-cleanup';

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
 * Cleans up [e2e] prefixed test data from database
 * Follows the selective cleanup pattern from db-cleanup.ts
 */
export async function cleanupTestData(): Promise<void> {
  const prisma = getPrismaClient();

  try {
    // Delete jobs associated with [e2e] tickets first
    await prisma.job.deleteMany({
      where: {
        ticket: {
          title: { startsWith: '[e2e]' },
        },
      },
    });

    // Delete [e2e] prefixed tickets
    await prisma.ticket.deleteMany({
      where: {
        title: { startsWith: '[e2e]' },
      },
    });

    // Delete [e2e] prefixed projects (except 1 and 2 to avoid cascade issues)
    await prisma.project.deleteMany({
      where: {
        name: { startsWith: '[e2e]' },
        id: { notIn: [1, 2] },
      },
    });

    console.log(' Test data cleaned successfully');
  } catch (error) {
    console.error(' Test data cleanup failed:', error);
    throw error;
  }
}
