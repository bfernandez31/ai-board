/**
 * Integration Tests: Ticket Jobs with Telemetry
 *
 * Tests for GET /api/projects/:projectId/tickets/:id/jobs endpoint
 * verifying that job telemetry fields are returned correctly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createAPIClient, type APIClient } from '@/tests/fixtures/vitest/api-client';
import type { TicketJobWithTelemetry } from '@/lib/types/job-types';

// Workflow token for PATCH /api/jobs/:id/status endpoint
const WORKFLOW_TOKEN = process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';

/**
 * Create an API client with workflow token authentication
 */
function createWorkflowClient(): APIClient {
  return createAPIClient({
    defaultHeaders: {
      'Authorization': `Bearer ${WORKFLOW_TOKEN}`,
    },
  });
}

describe('Ticket Jobs API', () => {
  let ctx: TestContext;
  let workflowApi: APIClient;
  let ticketId: number;
  let jobId: number;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    workflowApi = createWorkflowClient();
    await ctx.cleanup();

    // Create a test ticket
    const createResponse = await ctx.api.post<{ id: number }>(
      `/api/projects/${ctx.projectId}/tickets`,
      {
        title: '[e2e] Test Ticket for Jobs Telemetry',
        description: 'Test ticket for job telemetry testing',
      }
    );
    ticketId = createResponse.data.id;

    // Transition to create a job
    await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`, {
      targetStage: 'SPECIFY',
    });

    // Get the job ID
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { jobs: { orderBy: { createdAt: 'desc' } } },
    });
    jobId = ticket!.jobs[0]!.id;
  });

  describe('GET /api/projects/:projectId/tickets/:id/jobs', () => {
    it('should return jobs with telemetry fields', async () => {
      // Update job with telemetry data using direct DB update (simulating workflow completion)
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          startedAt: new Date('2025-01-01T10:00:00Z'),
          completedAt: new Date('2025-01-01T10:05:00Z'),
          inputTokens: 1000,
          outputTokens: 500,
          cacheReadTokens: 200,
          cacheCreationTokens: 100,
          costUsd: 0.05,
          durationMs: 300000,
          model: 'claude-3-opus',
          toolsUsed: ['read', 'write', 'bash'],
        },
      });

      const response = await ctx.api.get<TicketJobWithTelemetry[]>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs`
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);

      const job = response.data.find((j) => j.id === jobId);
      expect(job).toBeDefined();

      // Verify telemetry fields are present
      expect(job!.inputTokens).toBe(1000);
      expect(job!.outputTokens).toBe(500);
      expect(job!.cacheReadTokens).toBe(200);
      expect(job!.cacheCreationTokens).toBe(100);
      expect(Number(job!.costUsd)).toBeCloseTo(0.05, 2);
      expect(job!.durationMs).toBe(300000);
      expect(job!.model).toBe('claude-3-opus');
      expect(job!.toolsUsed).toEqual(['read', 'write', 'bash']);

      // Verify timing fields
      expect(job!.startedAt).toBeDefined();
      expect(job!.completedAt).toBeDefined();
    });

    it('should return jobs with null telemetry for pending jobs', async () => {
      const response = await ctx.api.get<TicketJobWithTelemetry[]>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs`
      );

      expect(response.status).toBe(200);

      const job = response.data.find((j) => j.id === jobId);
      expect(job).toBeDefined();
      expect(job!.status).toBe('PENDING');

      // Telemetry fields should be null for pending jobs
      expect(job!.inputTokens).toBeNull();
      expect(job!.outputTokens).toBeNull();
      expect(job!.costUsd).toBeNull();
      expect(job!.durationMs).toBeNull();
      expect(job!.model).toBeNull();
    });

    it('should return 404 for non-existent ticket', async () => {
      const response = await ctx.api.get<{ error: string }>(
        `/api/projects/${ctx.projectId}/tickets/999999/jobs`
      );

      expect(response.status).toBe(404);
    });

    it('should return 403 for ticket in different project', async () => {
      // Create a second project to test cross-project access
      const project2Response = await ctx.api.post<{ id: number }>('/api/projects', {
        name: '[e2e] Cross Project Test',
        key: 'CPT',
      });
      const project2Id = project2Response.data.id;

      // Try to access ticket from project 1 via project 2's endpoint
      const response = await ctx.api.get<{ error: string }>(
        `/api/projects/${project2Id}/tickets/${ticketId}/jobs`
      );

      expect(response.status).toBe(403);
      expect(response.data.error).toBe('Forbidden');

      // Cleanup: delete the second project
      await prisma.project.delete({ where: { id: project2Id } });
    });

    it('should return multiple jobs in order', async () => {
      // Complete the first job
      await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });
      await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'COMPLETED' });

      // Transition to next stage to create second job
      await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`, {
        targetStage: 'PLAN',
      });

      const response = await ctx.api.get<TicketJobWithTelemetry[]>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs`
      );

      expect(response.status).toBe(200);
      expect(response.data.length).toBe(2);

      // Jobs should be in ascending ID order
      expect(response.data[0]!.command).toBe('specify');
      expect(response.data[1]!.command).toBe('plan');
      expect(response.data[0]!.id).toBeLessThan(response.data[1]!.id);
    });
  });
});
