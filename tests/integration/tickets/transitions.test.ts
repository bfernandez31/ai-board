/**
 * Integration Tests: Ticket Transitions
 *
 * Migrated from: tests/api/ticket-transition.spec.ts, tests/api/ticket-stage-restrictions.spec.ts
 * Tests for ticket stage transition API endpoints.
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
        include: { jobs: true },
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

    it('should return 400 for invalid transition path (INBOX to BUILD)', async () => {
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Invalid path test',
          description: 'Test invalid transition path',
        }
      );
      const ticketId = createResponse.data.id;

      // INBOX → BUILD is not a valid normal transition (requires quick-impl)
      const response = await ctx.api.post<{ error: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'BUILD' }
      );

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('error');
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

  describe('Idempotency', () => {
    it('should return 200 for transition to same stage (idempotent)', async () => {
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Idempotent transition test',
          description: 'Test idempotent transition',
        }
      );
      const ticketId = createResponse.data.id;

      // First transition to SPECIFY
      await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`, {
        targetStage: 'SPECIFY',
      });

      // Second transition to SPECIFY (same stage)
      const response = await ctx.api.post<{ stage: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'SPECIFY' }
      );

      expect(response.status).toBe(200);
      expect(response.data.stage).toBe('SPECIFY');
    });
  });
});
