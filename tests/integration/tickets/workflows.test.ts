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

      // Verify in database
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
});
