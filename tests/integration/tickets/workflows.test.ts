/**
 * Integration Tests: Ticket Workflows
 *
 * Migrated from: tests/api/rollback-transition.spec.ts, tests/api/ticket-policy.spec.ts
 * Tests for ticket workflow types (FULL, QUICK, CLEAN) and rollback behavior.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('Ticket Workflows', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  describe('Quick Implementation Workflow', () => {
    it('should allow INBOX to BUILD transition with quick-impl flag', async () => {
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Quick impl ticket',
          description: 'Test quick implementation workflow',
        }
      );
      const ticketId = createResponse.data.id;

      // Quick-impl transition (INBOX → BUILD directly)
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
        include: { jobs: true },
      });

      expect(ticket?.workflowType).toBe('QUICK');
      expect(ticket?.jobs).toHaveLength(1);
      expect(ticket?.jobs[0]?.command).toBe('quick-impl');
    });

    it('should set workflowType to QUICK for quick-impl tickets', async () => {
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Quick workflow type test',
          description: 'Test workflowType is set to QUICK',
        }
      );
      const ticketId = createResponse.data.id;

      await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`, {
        targetStage: 'BUILD',
        quickImpl: true,
      });

      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      expect(ticket?.workflowType).toBe('QUICK');
    });
  });

  describe('Full Workflow', () => {
    it('should set workflowType to FULL for normal transitions', async () => {
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Full workflow type test',
          description: 'Test workflowType is set to FULL',
        }
      );
      const ticketId = createResponse.data.id;

      // Normal transition (INBOX → SPECIFY)
      await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`, {
        targetStage: 'SPECIFY',
      });

      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      expect(ticket?.workflowType).toBe('FULL');
    });
  });

  describe('Ticket Policy', () => {
    it('should inherit clarificationPolicy from project on creation', async () => {
      // Set project policy to CONSERVATIVE
      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { clarificationPolicy: 'CONSERVATIVE' },
      });

      const createResponse = await ctx.api.post<{ id: number; clarificationPolicy: string }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Policy inheritance test',
          description: 'Test policy inheritance from project',
        }
      );

      expect(createResponse.status).toBe(201);
      expect(createResponse.data.clarificationPolicy).toBe('CONSERVATIVE');
    });

    it('should allow override of clarificationPolicy on ticket creation', async () => {
      const createResponse = await ctx.api.post<{ id: number; clarificationPolicy: string }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Policy override test',
          description: 'Test policy override on creation',
          clarificationPolicy: 'INTERACTIVE',
        }
      );

      expect(createResponse.status).toBe(201);
      expect(createResponse.data.clarificationPolicy).toBe('INTERACTIVE');
    });

    it('should update ticket clarificationPolicy via PATCH', async () => {
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Policy update test',
          description: 'Test policy update via PATCH',
        }
      );
      const ticketId = createResponse.data.id;

      const response = await ctx.api.patch<{ clarificationPolicy: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}`,
        { clarificationPolicy: 'PRAGMATIC' }
      );

      expect(response.status).toBe(200);
      expect(response.data.clarificationPolicy).toBe('PRAGMATIC');
    });

    it('should return 400 for invalid clarificationPolicy', async () => {
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Invalid policy test',
          description: 'Test invalid policy value',
        }
      );
      const ticketId = createResponse.data.id;

      const response = await ctx.api.patch<{ error: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}`,
        { clarificationPolicy: 'INVALID_POLICY' }
      );

      expect(response.status).toBe(400);
    });
  });

  describe('Rollback Behavior', () => {
    it('should rollback QUICK ticket from BUILD to INBOX on failed job', async () => {
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Rollback test ticket',
          description: 'Test rollback on failed quick-impl job',
        }
      );
      const ticketId = createResponse.data.id;

      // Transition to BUILD via quick-impl
      await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`, {
        targetStage: 'BUILD',
        quickImpl: true,
      });

      // Get the job ID
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { jobs: { orderBy: { createdAt: 'desc' } } },
      });
      const jobId = ticket?.jobs[0]?.id;

      // Simulate job failure via workflow token
      const workflowToken = process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';
      await ctx.api.patch(`/api/jobs/${jobId}/status`, {
        status: 'FAILED',
      });

      // Verify ticket rolled back to INBOX
      const updatedTicket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      expect(updatedTicket?.stage).toBe('INBOX');
    });
  });

  describe('Branch Assignment', () => {
    it('should allow branch assignment via workflow token', async () => {
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Branch assignment test',
          description: 'Test branch assignment via workflow',
        }
      );
      const ticketId = createResponse.data.id;

      // Transition to SPECIFY
      await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`, {
        targetStage: 'SPECIFY',
      });

      // Assign branch
      const branchName = `feature/ticket-${ticketId}`;
      const workflowToken = process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';

      const response = await ctx.api.patch<{ branch: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/branch`,
        { branch: branchName }
      );

      expect(response.status).toBe(200);
      expect(response.data.branch).toBe(branchName);

      // Verify in database
      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      expect(ticket?.branch).toBe(branchName);
    });
  });
});
