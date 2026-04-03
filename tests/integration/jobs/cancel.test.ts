/**
 * Integration Tests: Cancel Job Endpoint
 * POST /api/jobs/:id/cancel
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('Cancel Job', () => {
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
        title: '[e2e] Test Ticket for Cancel',
        description: 'Test ticket for cancel job testing',
      }
    );
    ticketId = createResponse.data.id;

    // Transition to SPECIFY to create a job
    await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`, {
      targetStage: 'SPECIFY',
    });

    // Get the job ID
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { jobs: { orderBy: { id: 'desc' } } },
    });
    jobId = ticket!.jobs[0]!.id;
  });

  describe('POST /api/jobs/:id/cancel', () => {
    it('should cancel a PENDING job', async () => {
      const response = await ctx.api.post<{ id: number; status: string; completedAt: string }>(
        `/api/jobs/${jobId}/cancel`
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('CANCELLED');
      expect(response.data.completedAt).toBeTruthy();

      // Verify database state
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      expect(job?.status).toBe('CANCELLED');
      expect(job?.completedAt).not.toBeNull();
    });

    it('should cancel a RUNNING job', async () => {
      // Set job to RUNNING first (directly in DB since we can't use workflow auth easily)
      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      const response = await ctx.api.post<{ id: number; status: string }>(
        `/api/jobs/${jobId}/cancel`
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('CANCELLED');
    });

    it('should be idempotent for already CANCELLED job', async () => {
      // Cancel the job first
      await ctx.api.post(`/api/jobs/${jobId}/cancel`);

      // Cancel again
      const response = await ctx.api.post<{ id: number; status: string }>(
        `/api/jobs/${jobId}/cancel`
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('CANCELLED');
    });

    it('should reject cancel for COMPLETED job', async () => {
      // Set job to COMPLETED
      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      const response = await ctx.api.post<{ error: string }>(
        `/api/jobs/${jobId}/cancel`
      );

      expect(response.status).toBe(400);
      expect(response.data.error).toContain('does not allow cancellation');
    });

    it('should reject cancel for FAILED job', async () => {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'FAILED', completedAt: new Date() },
      });

      const response = await ctx.api.post<{ error: string }>(
        `/api/jobs/${jobId}/cancel`
      );

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent job', async () => {
      const response = await ctx.api.post('/api/jobs/999999/cancel');

      expect(response.status).toBe(404);
    });
  });
});
