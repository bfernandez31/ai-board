/**
 * Integration Tests: Extended Rollback Transitions
 *
 * Tests for the new rollback transitions: SPECIFY→INBOX, PLAN→SPECIFY,
 * BUILD→PLAN, VERIFY→BUILD. Each validates correct stage, workflow type,
 * and job status conditions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('Extended Rollback Transitions', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  /**
   * Helper: create a ticket in the given stage with a FAILED job
   */
  async function createTicketInStage(stage: string, jobStatus: string = 'FAILED') {
    const createResp = await ctx.api.post<{ id: number }>(
      `/api/projects/${ctx.projectId}/tickets`,
      { title: '[e2e] Rollback test', description: 'Rollback transition test' }
    );
    const ticketId = createResp.data.id;

    // Set stage and workflow type via DB (more reliable than sequential transitions)
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { stage: stage as 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY', workflowType: 'FULL' },
    });

    // Create a job with the desired status
    const job = await prisma.job.create({
      data: {
        ticketId,
        projectId: ctx.projectId,
        command: 'specify',
        status: jobStatus as 'FAILED' | 'CANCELLED' | 'RUNNING' | 'PENDING',
        startedAt: new Date(),
        updatedAt: new Date(),
        completedAt: ['FAILED', 'CANCELLED', 'COMPLETED'].includes(jobStatus) ? new Date() : undefined,
      },
    });

    return { ticketId, jobId: job.id };
  }

  describe('SPECIFY → INBOX', () => {
    it('should rollback SPECIFY to INBOX with FAILED job', async () => {
      const { ticketId } = await createTicketInStage('SPECIFY', 'FAILED');

      const response = await ctx.api.post<{ id: number; stage: string; version: number }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'INBOX' }
      );

      expect(response.status).toBe(200);
      expect(response.data.stage).toBe('INBOX');
      expect(response.data.version).toBe(1); // Reset to 1

      // Verify job was deleted
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { jobs: true },
      });
      expect(ticket!.jobs.length).toBe(0);
    });

    it('should reject SPECIFY to INBOX with RUNNING job', async () => {
      const { ticketId } = await createTicketInStage('SPECIFY', 'RUNNING');

      const response = await ctx.api.post<{ error: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'INBOX' }
      );

      expect(response.status).toBe(400);
    });
  });

  describe('PLAN → SPECIFY', () => {
    it('should rollback PLAN to SPECIFY with FAILED job', async () => {
      const { ticketId } = await createTicketInStage('PLAN', 'FAILED');

      const response = await ctx.api.post<{ id: number; stage: string; version: number }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'SPECIFY' }
      );

      expect(response.status).toBe(200);
      expect(response.data.stage).toBe('SPECIFY');
    });

    it('should reject PLAN to SPECIFY with RUNNING job', async () => {
      const { ticketId } = await createTicketInStage('PLAN', 'RUNNING');

      const response = await ctx.api.post<{ error: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'SPECIFY' }
      );

      expect(response.status).toBe(400);
    });
  });

  describe('BUILD → PLAN', () => {
    it('should rollback BUILD to PLAN with FAILED job', async () => {
      const { ticketId } = await createTicketInStage('BUILD', 'FAILED');

      const response = await ctx.api.post<{ id: number; stage: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'PLAN' }
      );

      expect(response.status).toBe(200);
      expect(response.data.stage).toBe('PLAN');
    });

    it('should reject BUILD to PLAN with PENDING job', async () => {
      const { ticketId } = await createTicketInStage('BUILD', 'PENDING');

      const response = await ctx.api.post<{ error: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'PLAN' }
      );

      expect(response.status).toBe(400);
    });

    it('should reject BUILD to PLAN for QUICK workflow', async () => {
      const { ticketId } = await createTicketInStage('BUILD', 'FAILED');
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { workflowType: 'QUICK' },
      });

      const response = await ctx.api.post<{ error: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'PLAN' }
      );

      expect(response.status).toBe(400);
    });
  });

  describe('VERIFY → BUILD', () => {
    it('should rollback VERIFY to BUILD with FAILED job', async () => {
      const { ticketId } = await createTicketInStage('VERIFY', 'FAILED');

      const response = await ctx.api.post<{ id: number; stage: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'BUILD' }
      );

      expect(response.status).toBe(200);
      expect(response.data.stage).toBe('BUILD');
    });

    it('should rollback VERIFY to BUILD with CANCELLED job', async () => {
      const { ticketId } = await createTicketInStage('VERIFY', 'CANCELLED');

      const response = await ctx.api.post<{ id: number; stage: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'BUILD' }
      );

      expect(response.status).toBe(200);
      expect(response.data.stage).toBe('BUILD');
    });

    it('should reject VERIFY to BUILD with RUNNING job', async () => {
      const { ticketId } = await createTicketInStage('VERIFY', 'RUNNING');

      const response = await ctx.api.post<{ error: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'BUILD' }
      );

      expect(response.status).toBe(400);
    });
  });
});
