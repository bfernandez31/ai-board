/**
 * Integration Tests: Jobs Status - Active-Only Filter
 *
 * Verifies that GET /api/projects/:projectId/jobs/status only returns
 * PENDING and RUNNING jobs (terminal jobs excluded).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createAPIClient, type APIClient } from '@/tests/fixtures/vitest/api-client';

const WORKFLOW_TOKEN = process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';

function createWorkflowClient(): APIClient {
  return createAPIClient({
    defaultHeaders: {
      'Authorization': `Bearer ${WORKFLOW_TOKEN}`,
    },
  });
}

describe('Jobs Status - Active-Only Filter', () => {
  let ctx: TestContext;
  let workflowApi: APIClient;
  let ticketId: number;
  let jobId: number;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    workflowApi = createWorkflowClient();
    await ctx.cleanup();

    // Create a test ticket and transition to SPECIFY to create a job
    const createResponse = await ctx.api.post<{ id: number }>(
      `/api/projects/${ctx.projectId}/tickets`,
      {
        title: '[e2e] Jobs Filter Test',
        description: 'Test ticket for jobs active-only filter',
      }
    );
    ticketId = createResponse.data.id;

    await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`, {
      targetStage: 'SPECIFY',
    });

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { jobs: { orderBy: { id: 'desc' } } },
    });
    jobId = ticket!.jobs[0]!.id;
  });

  it('should return PENDING jobs', async () => {
    const response = await ctx.api.get<{ jobs: Array<{ id: number; status: string }> }>(
      `/api/projects/${ctx.projectId}/jobs/status`
    );

    expect(response.status).toBe(200);
    const job = response.data.jobs.find((j) => j.id === jobId);
    expect(job).toBeDefined();
    expect(job!.status).toBe('PENDING');
  });

  it('should return RUNNING jobs', async () => {
    await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });

    const response = await ctx.api.get<{ jobs: Array<{ id: number; status: string }> }>(
      `/api/projects/${ctx.projectId}/jobs/status`
    );

    expect(response.status).toBe(200);
    const job = response.data.jobs.find((j) => j.id === jobId);
    expect(job).toBeDefined();
    expect(job!.status).toBe('RUNNING');
  });

  it('should NOT return COMPLETED jobs', async () => {
    await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });
    await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'COMPLETED' });

    const response = await ctx.api.get<{ jobs: Array<{ id: number; status: string }> }>(
      `/api/projects/${ctx.projectId}/jobs/status`
    );

    expect(response.status).toBe(200);
    const job = response.data.jobs.find((j) => j.id === jobId);
    expect(job).toBeUndefined();
  });

  it('should NOT return FAILED jobs', async () => {
    await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });
    await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'FAILED' });

    const response = await ctx.api.get<{ jobs: Array<{ id: number; status: string }> }>(
      `/api/projects/${ctx.projectId}/jobs/status`
    );

    expect(response.status).toBe(200);
    const job = response.data.jobs.find((j) => j.id === jobId);
    expect(job).toBeUndefined();
  });

  it('should NOT return CANCELLED jobs', async () => {
    await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });
    await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'CANCELLED' });

    const response = await ctx.api.get<{ jobs: Array<{ id: number; status: string }> }>(
      `/api/projects/${ctx.projectId}/jobs/status`
    );

    expect(response.status).toBe(200);
    const job = response.data.jobs.find((j) => j.id === jobId);
    expect(job).toBeUndefined();
  });

  it('should return empty array when all jobs are terminal', async () => {
    await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });
    await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'COMPLETED' });

    const response = await ctx.api.get<{ jobs: Array<{ id: number; status: string }> }>(
      `/api/projects/${ctx.projectId}/jobs/status`
    );

    expect(response.status).toBe(200);
    // Filter to only this test's jobs (other tests may have residual data)
    const testJobs = response.data.jobs.filter((j) => j.id === jobId);
    expect(testJobs).toHaveLength(0);
  });
});
