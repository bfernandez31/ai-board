/**
 * Integration Tests: Jobs Status
 *
 * Migrated from: tests/api/polling/job-status.spec.ts, tests/e2e/jobs/*.spec.ts
 * Tests for job status API endpoints using Vitest integration test infrastructure.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('Jobs Status', () => {
  let ctx: TestContext;
  let ticketId: number;
  let jobId: number;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();

    // Create a test ticket
    const createResponse = await ctx.api.post<{ id: number }>(
      `/api/projects/${ctx.projectId}/tickets`,
      {
        title: '[e2e] Test Ticket for Jobs',
        description: 'Test ticket for job status testing',
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

  describe('GET /api/projects/:projectId/jobs/status', () => {
    it('should return job status for project', async () => {
      const response = await ctx.api.get<Array<{ id: number; status: string; command: string }>>(
        `/api/projects/${ctx.projectId}/jobs/status`
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);

      const job = response.data.find((j) => j.id === jobId);
      expect(job).toBeDefined();
      expect(job!.status).toBe('PENDING');
      expect(job!.command).toBe('specify');
    });

    it('should return 404 for non-existent project', async () => {
      const response = await ctx.api.get('/api/projects/999999/jobs/status');

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/jobs/:id/status', () => {
    it('should update job status to RUNNING', async () => {
      const response = await ctx.api.patch<{ id: number; status: string }>(
        `/api/jobs/${jobId}/status`,
        { status: 'RUNNING' }
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('RUNNING');

      // Verify database state
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.status).toBe('RUNNING');
      expect(job?.startedAt).not.toBeNull();
    });

    it('should update job status to COMPLETED', async () => {
      // First set to RUNNING
      await ctx.api.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });

      // Then set to COMPLETED
      const response = await ctx.api.patch<{ id: number; status: string }>(
        `/api/jobs/${jobId}/status`,
        { status: 'COMPLETED' }
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('COMPLETED');

      // Verify database state
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.status).toBe('COMPLETED');
      expect(job?.completedAt).not.toBeNull();
    });

    it('should update job status to FAILED', async () => {
      // First set to RUNNING
      await ctx.api.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });

      // Then set to FAILED
      const response = await ctx.api.patch<{ id: number; status: string }>(
        `/api/jobs/${jobId}/status`,
        { status: 'FAILED' }
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('FAILED');

      // Verify database state
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.status).toBe('FAILED');
      expect(job?.completedAt).not.toBeNull();
    });

    it('should return 400 for invalid status', async () => {
      const response = await ctx.api.patch<{ error: string }>(
        `/api/jobs/${jobId}/status`,
        { status: 'INVALID_STATUS' }
      );

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('error');
    });

    it('should return 404 for non-existent job', async () => {
      const response = await ctx.api.patch(
        '/api/jobs/999999/status',
        { status: 'RUNNING' }
      );

      expect(response.status).toBe(404);
    });

    it('should update status to CANCELLED', async () => {
      const response = await ctx.api.patch<{ id: number; status: string }>(
        `/api/jobs/${jobId}/status`,
        { status: 'CANCELLED' }
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('CANCELLED');
    });
  });

  describe('Job status lifecycle', () => {
    it('should track full job lifecycle: PENDING → RUNNING → COMPLETED', async () => {
      // Verify initial PENDING state
      let job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.status).toBe('PENDING');
      expect(job?.startedAt).toBeNull();
      expect(job?.completedAt).toBeNull();

      // Transition to RUNNING
      await ctx.api.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });
      job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.status).toBe('RUNNING');
      expect(job?.startedAt).not.toBeNull();
      expect(job?.completedAt).toBeNull();

      // Transition to COMPLETED
      await ctx.api.patch(`/api/jobs/${jobId}/status`, { status: 'COMPLETED' });
      job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.status).toBe('COMPLETED');
      expect(job?.startedAt).not.toBeNull();
      expect(job?.completedAt).not.toBeNull();
    });
  });

  describe('Multiple jobs per ticket', () => {
    it('should handle multiple jobs for same ticket', async () => {
      // Complete the first job
      await ctx.api.patch(`/api/jobs/${jobId}/status`, { status: 'RUNNING' });
      await ctx.api.patch(`/api/jobs/${jobId}/status`, { status: 'COMPLETED' });

      // Transition to next stage to create second job
      await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`, {
        targetStage: 'PLAN',
      });

      // Get all jobs for the ticket
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { jobs: { orderBy: { createdAt: 'asc' } } },
      });

      expect(ticket?.jobs.length).toBe(2);
      expect(ticket?.jobs[0]?.status).toBe('COMPLETED');
      expect(ticket?.jobs[0]?.command).toBe('specify');
      expect(ticket?.jobs[1]?.status).toBe('PENDING');
      expect(ticket?.jobs[1]?.command).toBe('plan');
    });
  });
});
