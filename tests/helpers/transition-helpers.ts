import { APIRequestContext } from '@playwright/test';

/**
 * Test helpers for transition API E2E tests
 */

/**
 * Extract job ID from transition response
 * The API returns the full updated ticket object, but we need to fetch the job ID separately
 */
export async function getLatestJobId(
  _request: APIRequestContext,
  ticketId: number
): Promise<number | undefined> {
  const prisma = (await import('../helpers/db-cleanup')).getPrismaClient();
  const jobs = await prisma.job.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });
  return jobs[0]?.id;
}

/**
 * Transitions a ticket through multiple stages sequentially
 * @param request Playwright APIRequestContext
 * @param projectId Project ID for worker isolation
 * @param ticketId Ticket ID to transition
 * @param stages Array of stage names to transition through (e.g., ['SPECIFY', 'PLAN', 'BUILD'])
 */
export async function transitionThrough(
  request: APIRequestContext,
  projectId: number,
  ticketId: number,
  stages: string[]
): Promise<void> {
  for (const stage of stages) {
    const response = await request.post(`/api/projects/${projectId}/tickets/${ticketId}/transition`, {
      data: { targetStage: stage },
    });

    // Check response status
    if (!response.ok()) {
      const body = await response.json();
      throw new Error(`Transition to ${stage} failed: ${JSON.stringify(body)}`);
    }

    // For automated stages, simulate job completion
    if (['SPECIFY', 'PLAN', 'BUILD'].includes(stage)) {
      // API returns full ticket, fetch job ID from database
      const jobId = await getLatestJobId(request, ticketId);
      const workflowToken = process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';

      if (jobId) {
        // Transition job to RUNNING then COMPLETED
        await request.patch(`/api/jobs/${jobId}/status`, {
          data: { status: 'RUNNING' },
          headers: { 'Authorization': `Bearer ${workflowToken}` },
        });

        await request.patch(`/api/jobs/${jobId}/status`, {
          data: { status: 'COMPLETED' },
          headers: { 'Authorization': `Bearer ${workflowToken}` },
        });
      }

      // After SPECIFY transition, simulate workflow setting branch
      if (stage === 'SPECIFY') {
        const branchName = `feature/ticket-${ticketId}`;

        const branchResponse = await request.patch(`/api/projects/${projectId}/tickets/${ticketId}/branch`, {
          data: { branch: branchName },
          headers: {
            'Authorization': `Bearer ${workflowToken}`,
          },
        });

        if (!branchResponse.ok()) {
          const body = await branchResponse.json();
          throw new Error(`Branch update failed: ${JSON.stringify(body)}`);
        }
      }
    }
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
