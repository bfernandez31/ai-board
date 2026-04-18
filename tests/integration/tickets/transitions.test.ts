/**
 * Integration Tests: Ticket Transitions
 *
 * Migrated from: tests/api/ticket-transition.spec.ts, tests/api/ticket-stage-restrictions.spec.ts,
 *   tests/api/rollback-transition.spec.ts, tests/api/ticket-policy.spec.ts
 * Tests for ticket stage transitions, workflow types, and ticket policies.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('Ticket Transitions', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  describe('POST /api/projects/:projectId/tickets/:id/transition', () => {
    it('should transition ticket from INBOX to SPECIFY', async () => {
      // Create a ticket
      const createResponse = await ctx.api.post<{ id: number; stage: string }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Transition test ticket',
          description: 'Test ticket for transition testing',
        }
      );
      expect(createResponse.status).toBe(201);
      const ticketId = createResponse.data.id;

      // Transition to SPECIFY
      const response = await ctx.api.post<{ id: number; stage: string; version: number }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'SPECIFY' }
      );

      expect(response.status).toBe(200);
      expect(response.data.id).toBe(ticketId);
      expect(response.data.stage).toBe('SPECIFY');
      expect(response.data.version).toBe(2); // Incremented from 1

      // Verify database state
      const updatedTicket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { jobs: { orderBy: { createdAt: 'desc' } } },
      });

      expect(updatedTicket?.stage).toBe('SPECIFY');
      expect(updatedTicket?.version).toBe(2);
      expect(updatedTicket?.jobs).toHaveLength(1);
      expect(updatedTicket?.jobs[0]?.command).toBe('specify');
      expect(updatedTicket?.jobs[0]?.status).toBe('PENDING');
    });

    it('should create job with PENDING status on transition', async () => {
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Job creation test',
          description: 'Test that jobs are created on transition',
        }
      );
      const ticketId = createResponse.data.id;

      await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`, {
        targetStage: 'SPECIFY',
      });

      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { jobs: { orderBy: { createdAt: 'desc' } } },
      });

      expect(ticket?.jobs).toHaveLength(1);
      expect(ticket?.jobs[0]?.status).toBe('PENDING');
      expect(ticket?.jobs[0]?.command).toBe('specify');
    });

    it('should return 400 for invalid targetStage', async () => {
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Invalid transition test',
          description: 'Test invalid stage transition',
        }
      );
      const ticketId = createResponse.data.id;

      const response = await ctx.api.post<{ error: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'INVALID_STAGE' }
      );

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('error');
    });

    it('should return 404 for non-existent ticket', async () => {
      const response = await ctx.api.post(
        `/api/projects/${ctx.projectId}/tickets/999999/transition`,
        { targetStage: 'SPECIFY' }
      );

      expect(response.status).toBe(404);
    });

    it('should allow INBOX to BUILD transition (quick-impl) and create correct job', async () => {
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Quick impl test',
          description: 'Test quick-impl transition path',
        }
      );
      const ticketId = createResponse.data.id;

      // INBOX → BUILD is valid (quick-impl path)
      const response = await ctx.api.post<{ id: number; stage: string; workflowType: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'BUILD', quickImpl: true }
      );

      expect(response.status).toBe(200);
      expect(response.data.stage).toBe('BUILD');
      expect(response.data.workflowType).toBe('QUICK');

      // Verify job was created with quick-impl command
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { jobs: { orderBy: { createdAt: 'desc' } } },
      });

      expect(ticket?.workflowType).toBe('QUICK');
      expect(ticket?.jobs).toHaveLength(1);
      expect(ticket?.jobs[0]?.command).toBe('quick-impl');
    });

    it('should not allow transitioning backwards (SPECIFY to INBOX)', async () => {
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Backward transition test',
          description: 'Test backward transition is not allowed',
        }
      );
      const ticketId = createResponse.data.id;

      // Move to SPECIFY first
      await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`, {
        targetStage: 'SPECIFY',
      });

      // Try to go back to INBOX
      const response = await ctx.api.post<{ error: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'INBOX' }
      );

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('error');
    });
  });

  describe('Stage restrictions', () => {
    it('should not allow INBOX ticket to skip to VERIFY', async () => {
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Skip stage test',
          description: 'Test that stages cannot be skipped',
        }
      );
      const ticketId = createResponse.data.id;

      const response = await ctx.api.post<{ error: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'VERIFY' }
      );

      expect(response.status).toBe(400);
    });

    it('should not allow INBOX ticket to skip to SHIP', async () => {
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Ship skip test',
          description: 'Test that SHIP cannot be skipped to',
        }
      );
      const ticketId = createResponse.data.id;

      const response = await ctx.api.post<{ error: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'SHIP' }
      );

      expect(response.status).toBe(400);
    });
  });

  describe('Same-stage transitions', () => {
    it('should return 400 for transition to same stage (not allowed)', async () => {
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Same-stage transition test',
          description: 'Test same-stage transition is not allowed',
        }
      );
      const ticketId = createResponse.data.id;

      // First transition to SPECIFY
      await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`, {
        targetStage: 'SPECIFY',
      });

      // Second transition to SPECIFY (same stage) - should be rejected
      const response = await ctx.api.post<{ error: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'SPECIFY' }
      );

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('error');
    });
  });

  describe('Workflow types', () => {
    it('should set workflowType to FULL for normal transitions', async () => {
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Full workflow type test',
          description: 'Test workflowType is set to FULL',
        }
      );
      const ticketId = createResponse.data.id;

      await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`, {
        targetStage: 'SPECIFY',
      });

      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      expect(ticket?.workflowType).toBe('FULL');
    });
  });

  describe('Rollback Transitions', () => {
    async function createTicketInStage(stage: string, jobStatus: string = 'FAILED') {
      const createResp = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        { title: '[e2e] Rollback test', description: 'Rollback transition test' }
      );
      const ticketId = createResp.data.id;

      await prisma.ticket.update({
        where: { id: ticketId },
        data: { stage: stage as 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY', workflowType: 'FULL' },
      });

      await prisma.job.create({
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

      return ticketId;
    }

    describe('SPECIFY → INBOX', () => {
      it('should rollback with FAILED job and clear branch/jobs', async () => {
        const ticketId = await createTicketInStage('SPECIFY', 'FAILED');
        await prisma.ticket.update({ where: { id: ticketId }, data: { branch: 'test-specify-branch' } });

        const response = await ctx.api.post<{ id: number; stage: string; branch: string | null }>(
          `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
          { targetStage: 'INBOX' }
        );

        expect(response.status).toBe(200);
        expect(response.data.stage).toBe('INBOX');
        expect(response.data.branch).toBeNull();

        const ticket = await prisma.ticket.findUnique({
          where: { id: ticketId },
          include: { jobs: true },
        });
        expect(ticket!.jobs.length).toBe(0);
      });

      it('should rollback with CANCELLED job (no branch)', async () => {
        const ticketId = await createTicketInStage('SPECIFY', 'CANCELLED');

        const response = await ctx.api.post<{ id: number; stage: string; branch: string | null }>(
          `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
          { targetStage: 'INBOX' }
        );

        expect(response.status).toBe(200);
        expect(response.data.stage).toBe('INBOX');
        expect(response.data.branch).toBeNull();
      });

      it('should reject with RUNNING job', async () => {
        const ticketId = await createTicketInStage('SPECIFY', 'RUNNING');

        const response = await ctx.api.post<{ error: string }>(
          `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
          { targetStage: 'INBOX' }
        );

        expect(response.status).toBe(400);
      });
    });

    describe('PLAN → SPECIFY', () => {
      it('should rollback with FAILED job', async () => {
        const ticketId = await createTicketInStage('PLAN', 'FAILED');

        const response = await ctx.api.post<{ id: number; stage: string }>(
          `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
          { targetStage: 'SPECIFY' }
        );

        expect(response.status).toBe(200);
        expect(response.data.stage).toBe('SPECIFY');
      });

      it('should reject with RUNNING job', async () => {
        const ticketId = await createTicketInStage('PLAN', 'RUNNING');

        const response = await ctx.api.post<{ error: string }>(
          `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
          { targetStage: 'SPECIFY' }
        );

        expect(response.status).toBe(400);
      });
    });

    describe('BUILD → PLAN', () => {
      it('should rollback with FAILED job (FULL workflow)', async () => {
        const ticketId = await createTicketInStage('BUILD', 'FAILED');

        const response = await ctx.api.post<{ id: number; stage: string }>(
          `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
          { targetStage: 'PLAN' }
        );

        expect(response.status).toBe(200);
        expect(response.data.stage).toBe('PLAN');
      });

      it('should reject with PENDING job', async () => {
        const ticketId = await createTicketInStage('BUILD', 'PENDING');

        const response = await ctx.api.post<{ error: string }>(
          `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
          { targetStage: 'PLAN' }
        );

        expect(response.status).toBe(400);
      });

      it('should reject for QUICK workflow', async () => {
        const ticketId = await createTicketInStage('BUILD', 'FAILED');
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
      it('should rollback with FAILED job', async () => {
        const ticketId = await createTicketInStage('VERIFY', 'FAILED');

        const response = await ctx.api.post<{ id: number; stage: string }>(
          `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
          { targetStage: 'BUILD' }
        );

        expect(response.status).toBe(200);
        expect(response.data.stage).toBe('BUILD');
      });

      it('should rollback with CANCELLED job', async () => {
        const ticketId = await createTicketInStage('VERIFY', 'CANCELLED');

        const response = await ctx.api.post<{ id: number; stage: string }>(
          `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
          { targetStage: 'BUILD' }
        );

        expect(response.status).toBe(200);
        expect(response.data.stage).toBe('BUILD');
      });

      it('should reject with RUNNING job', async () => {
        const ticketId = await createTicketInStage('VERIFY', 'RUNNING');

        const response = await ctx.api.post<{ error: string }>(
          `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
          { targetStage: 'BUILD' }
        );

        expect(response.status).toBe(400);
      });
    });
  });

  describe('Ticket policy', () => {
    it('should allow override of clarificationPolicy on ticket creation', async () => {
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Policy override test',
          description: 'Test policy override on creation',
          clarificationPolicy: 'INTERACTIVE',
        }
      );
      const ticketId = createResponse.data.id;

      expect(createResponse.status).toBe(201);

      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      expect(ticket?.clarificationPolicy).toBe('INTERACTIVE');
    });

    it('should update ticket clarificationPolicy via PATCH', async () => {
      const createResponse = await ctx.api.post<{ id: number; version: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Policy update test',
          description: 'Test policy update via PATCH',
        }
      );
      const ticketId = createResponse.data.id;
      const version = createResponse.data.version;

      const response = await ctx.api.patch<{ clarificationPolicy: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}`,
        { clarificationPolicy: 'PRAGMATIC', version }
      );

      expect(response.status).toBe(200);
      expect(response.data.clarificationPolicy).toBe('PRAGMATIC');
    });

    it('should return 400 for invalid clarificationPolicy', async () => {
      const createResponse = await ctx.api.post<{ id: number; version: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Invalid policy test',
          description: 'Test invalid policy value',
        }
      );
      const ticketId = createResponse.data.id;
      const version = createResponse.data.version;

      const response = await ctx.api.patch<{ error: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}`,
        { clarificationPolicy: 'INVALID_POLICY', version }
      );

      expect(response.status).toBe(400);
    });
  });

  describe('per-stage model resolution on dispatch (AIB-678)', () => {
    it('populates Job.model from the project default when no ticket override', async () => {
      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { specifyModel: 'claude-opus-4-6' },
      });

      const create = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Model resolve project default',
          description: 'Test project default resolution',
        }
      );
      const ticketId = create.data.id;

      await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`, {
        targetStage: 'SPECIFY',
      });

      const job = await prisma.job.findFirst({
        where: { ticketId },
        orderBy: { createdAt: 'desc' },
      });
      expect(job?.model).toBe('claude-opus-4-6');
    });

    it('ticket override wins over project default for IMPLEMENT (quick-impl flow)', async () => {
      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { quickImplModel: 'claude-sonnet-4-6' },
      });

      const create = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Quick-impl override',
          description: 'quick-impl override',
        }
      );
      const ticketId = create.data.id;

      await prisma.ticket.update({
        where: { id: ticketId },
        data: { quickImplModel: 'claude-haiku-4-5-20251001' },
      });

      // INBOX -> BUILD triggers quick-impl
      await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`, {
        targetStage: 'BUILD',
      });

      const job = await prisma.job.findFirst({
        where: { ticketId, command: 'quick-impl' },
        orderBy: { createdAt: 'desc' },
      });
      expect(job?.model).toBe('claude-haiku-4-5-20251001');
    });

    it('Job.model is null when project default agent is non-Claude even with overrides', async () => {
      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { defaultAgent: 'GEMINI', implementModel: 'claude-sonnet-4-6' },
      });

      try {
        const create = await ctx.api.post<{ id: number }>(
          `/api/projects/${ctx.projectId}/tickets`,
          {
            title: '[e2e] Non-Claude dormant',
            description: 'Gemini agent',
          }
        );
        const ticketId = create.data.id;

        await prisma.ticket.update({
          where: { id: ticketId },
          data: { implementModel: 'claude-opus-4-7' },
        });

        const response = await ctx.api.post(
          `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
          { targetStage: 'SPECIFY' }
        );
        // Either the SPECIFY worked (200) or the agent does not support SPECIFY (400)
        if (response.status === 200) {
          const job = await prisma.job.findFirst({
            where: { ticketId, command: 'specify' },
            orderBy: { createdAt: 'desc' },
          });
          expect(job?.model).toBeNull();
        }
      } finally {
        await prisma.project.update({
          where: { id: ctx.projectId },
          data: { defaultAgent: 'CLAUDE', implementModel: null },
        });
      }
    });
  });
});
