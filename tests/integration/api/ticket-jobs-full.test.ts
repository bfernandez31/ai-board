/**
 * Integration Tests: GET /api/projects/[projectId]/tickets/[id]/jobs/full
 *
 * Tests for fetching full job data with telemetry for ticket modal stats display.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';

describe('GET /api/projects/:projectId/tickets/:ticketId/jobs/full', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('should return empty array when ticket has no jobs', async () => {
    // Create a ticket without any jobs
    const ticketResponse = await ctx.api.post<{ id: number }>(
      `/api/projects/${ctx.projectId}/tickets`,
      {
        title: '[e2e] Test Ticket',
        description: 'Test description',
      }
    );
    const ticketId = ticketResponse.data.id;

    const response = await ctx.api.get<any[]>(
      `/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs/full`
    );

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.data).toHaveLength(0);
  });

  it('should return full job data with telemetry fields when jobs exist', async () => {
    // Create a ticket
    const ticketResponse = await ctx.api.post<{ id: number }>(
      `/api/projects/${ctx.projectId}/tickets`,
      {
        title: '[e2e] Test Ticket with Job',
        description: 'Test description',
      }
    );
    const ticketId = ticketResponse.data.id;

    // Create a job for the ticket
    const jobResponse = await ctx.api.post<{ id: number }>(
      `/api/jobs`,
      {
        ticketId,
        command: 'specify',
        workflowRunId: 12345,
        workflowRunUrl: 'https://github.com/test/repo/actions/runs/12345',
      }
    );
    const jobId = jobResponse.data.id;

    // Fetch full jobs
    const response = await ctx.api.get<any[]>(
      `/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs/full`
    );

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.data).toHaveLength(1);

    // Verify all telemetry fields are present
    const fullJob = response.data[0];
    expect(fullJob.id).toBe(jobId);
    expect(fullJob.command).toBe('specify');
    expect(fullJob.status).toBe('PENDING');
    expect(fullJob).toHaveProperty('totalCost');
    expect(fullJob).toHaveProperty('totalDuration');
    expect(fullJob).toHaveProperty('totalTokens');
    expect(fullJob).toHaveProperty('cacheReadTokens');
    expect(fullJob).toHaveProperty('cacheWriteTokens');
    expect(fullJob).toHaveProperty('startedAt');
  });

  it('should return 400 for invalid project ID', async () => {
    const response = await ctx.api.get<{ error: string; code: string }>(
      `/api/projects/invalid/tickets/1/jobs/full`
    );

    expect(response.status).toBe(400);
    expect(response.data.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for invalid ticket ID', async () => {
    const response = await ctx.api.get<{ error: string; code: string }>(
      `/api/projects/${ctx.projectId}/tickets/invalid/jobs/full`
    );

    expect(response.status).toBe(400);
    expect(response.data.code).toBe('VALIDATION_ERROR');
  });

  it('should return 404 for non-existent ticket', async () => {
    const response = await ctx.api.get<{ error: string; code: string }>(
      `/api/projects/${ctx.projectId}/tickets/999999/jobs/full`
    );

    expect(response.status).toBe(404);
    expect(response.data.code).toBe('TICKET_NOT_FOUND');
  });

  it('should return jobs ordered by startedAt descending', async () => {
    // Create a ticket
    const ticketResponse = await ctx.api.post<{ id: number }>(
      `/api/projects/${ctx.projectId}/tickets`,
      {
        title: '[e2e] Test Ticket with Multiple Jobs',
        description: 'Test description',
      }
    );
    const ticketId = ticketResponse.data.id;

    // Create multiple jobs
    await ctx.api.post(`/api/jobs`, {
      ticketId,
      command: 'specify',
      workflowRunId: 1,
      workflowRunUrl: 'https://github.com/test/repo/actions/runs/1',
    });

    // Wait a bit to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    await ctx.api.post(`/api/jobs`, {
      ticketId,
      command: 'plan',
      workflowRunId: 2,
      workflowRunUrl: 'https://github.com/test/repo/actions/runs/2',
    });

    // Fetch full jobs
    const response = await ctx.api.get<any[]>(
      `/api/projects/${ctx.projectId}/tickets/${ticketId}/jobs/full`
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveLength(2);

    // Verify ordering (most recent first)
    expect(response.data[0].command).toBe('plan');
    expect(response.data[1].command).toBe('specify');
  });
});
