/**
 * Integration Tests: Ticket Duplication
 *
 * Tests for ticket duplication API endpoints:
 * - Simple copy (mode: "simple" or default) - creates copy in INBOX
 * - Full clone (mode: "full") - preserves stage, copies jobs, uses new branch
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { fullCloneTicket } from '@/lib/db/tickets';

describe('Ticket Duplication', () => {
  let ctx: TestContext;
  let ticketCounter = 1000;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  describe('POST /api/projects/:projectId/tickets/:id/duplicate (Simple Copy)', () => {
    it('should duplicate ticket with "Copy of " prefix and reset to INBOX', async () => {
      // Create source ticket in SPECIFY stage
      const prisma = getPrismaClient();
      const sourceTicket = await prisma.ticket.create({
        data: {
          title: '[e2e] Original Feature',
          description: 'Original description',
          stage: 'SPECIFY',
          projectId: ctx.projectId,
          ticketNumber: ++ticketCounter,
          ticketKey: `T-${ticketCounter}`,
          workflowType: 'FULL',
        },
      });

      const response = await ctx.api.post<{
        id: number;
        title: string;
        description: string;
        stage: string;
        branch: string | null;
        ticketKey: string;
      }>(`/api/projects/${ctx.projectId}/tickets/${sourceTicket.id}/duplicate`, {});

      expect(response.status).toBe(201);
      expect(response.data.title).toBe('Copy of [e2e] Original Feature');
      expect(response.data.description).toBe('Original description');
      expect(response.data.stage).toBe('INBOX'); // Reset to INBOX
      expect(response.data.branch).toBeNull(); // No branch
      expect(response.data.id).not.toBe(sourceTicket.id);
    });

    it('should duplicate ticket with explicit mode="simple"', async () => {
      const prisma = getPrismaClient();
      const sourceTicket = await prisma.ticket.create({
        data: {
          title: '[e2e] Simple Copy Test',
          description: 'Test description',
          stage: 'PLAN',
          projectId: ctx.projectId,
          ticketNumber: ++ticketCounter,
          ticketKey: `T-${ticketCounter}`,
          workflowType: 'FULL',
          branch: '100-simple-copy-test',
        },
      });

      const response = await ctx.api.post<{
        id: number;
        stage: string;
        branch: string | null;
      }>(`/api/projects/${ctx.projectId}/tickets/${sourceTicket.id}/duplicate`, {
        mode: 'simple',
      });

      expect(response.status).toBe(201);
      expect(response.data.stage).toBe('INBOX');
      expect(response.data.branch).toBeNull();
    });

    it('should NOT copy jobs with simple copy', async () => {
      const prisma = getPrismaClient();
      const sourceTicket = await prisma.ticket.create({
        data: {
          title: '[e2e] Ticket With Jobs',
          description: 'Has jobs',
          stage: 'PLAN',
          projectId: ctx.projectId,
          ticketNumber: ++ticketCounter,
          ticketKey: `T-${ticketCounter}`,
          workflowType: 'FULL',
        },
      });

      // Create a job for the source ticket
      await prisma.job.create({
        data: {
          ticketId: sourceTicket.id,
          projectId: ctx.projectId,
          command: 'specify',
          status: 'COMPLETED',
          inputTokens: 1000,
          outputTokens: 2000,
          updatedAt: new Date(),
        },
      });

      const response = await ctx.api.post<{
        id: number;
        jobs?: unknown[];
      }>(`/api/projects/${ctx.projectId}/tickets/${sourceTicket.id}/duplicate`, {});

      expect(response.status).toBe(201);

      // Verify no jobs were copied
      const copiedJobs = await prisma.job.findMany({
        where: { ticketId: response.data.id },
      });
      expect(copiedJobs).toHaveLength(0);
    });

    it('should preserve token-saving override with simple copy', async () => {
      const prisma = getPrismaClient();
      const sourceTicket = await prisma.ticket.create({
        data: {
          title: '[e2e] Token Override Copy',
          description: 'Preserve token-saving override',
          stage: 'PLAN',
          projectId: ctx.projectId,
          ticketNumber: ++ticketCounter,
          ticketKey: `T-${ticketCounter}`,
          workflowType: 'FULL',
          tokenSavingOverride: 'FORCE_ON',
        },
      });

      const response = await ctx.api.post<{
        id: number;
        stage: string;
        tokenSavingOverride: 'FORCE_ON' | 'FORCE_OFF' | null;
      }>(`/api/projects/${ctx.projectId}/tickets/${sourceTicket.id}/duplicate`, {});

      expect(response.status).toBe(201);
      expect(response.data.stage).toBe('INBOX');
      expect(response.data.tokenSavingOverride).toBe('FORCE_ON');

      const copiedTicket = await prisma.ticket.findUniqueOrThrow({
        where: { id: response.data.id },
        select: { tokenSavingOverride: true },
      });
      expect(copiedTicket.tokenSavingOverride).toBe('FORCE_ON');
    });
  });

  describe('POST /api/projects/:projectId/tickets/:id/duplicate (Full Clone)', () => {
    it('should return 400 when source ticket has no branch for full clone', async () => {
      const prisma = getPrismaClient();
      const sourceTicket = await prisma.ticket.create({
        data: {
          title: '[e2e] No Branch Ticket',
          description: 'Missing branch',
          stage: 'INBOX', // INBOX tickets typically have no branch
          projectId: ctx.projectId,
          ticketNumber: ++ticketCounter,
          ticketKey: `T-${ticketCounter}`,
          workflowType: 'FULL',
          branch: null, // No branch
        },
      });

      const response = await ctx.api.post<{
        error: string;
        code: string;
      }>(`/api/projects/${ctx.projectId}/tickets/${sourceTicket.id}/duplicate`, {
        mode: 'full',
      });

      expect(response.status).toBe(400);
      expect(response.data.code).toBe('MISSING_BRANCH');
      expect(response.data.error).toContain('branch');
    });

    it('should copy token-saving job telemetry snapshots with full clone', async () => {
      const prisma = getPrismaClient();
      const sourceTicket = await prisma.ticket.create({
        data: {
          title: '[e2e] Token Saving Full Clone',
          description: 'Preserve token-saving job telemetry',
          stage: 'VERIFY',
          projectId: ctx.projectId,
          ticketNumber: ++ticketCounter,
          ticketKey: `T-${ticketCounter}`,
          workflowType: 'FULL',
          branch: 'source-token-saving-branch',
          tokenSavingOverride: 'FORCE_OFF',
        },
      });

      await prisma.job.create({
        data: {
          ticketId: sourceTicket.id,
          projectId: ctx.projectId,
          command: 'verify',
          status: 'COMPLETED',
          branch: sourceTicket.branch,
          inputTokens: 1000,
          outputTokens: 500,
          tokenSavingRequested: true,
          tokenSavingStatus: 'FALLBACK',
          tokenSavingFallbackReason: 'rtk init failed',
          updatedAt: new Date('2026-06-03T10:00:00.000Z'),
        },
      });

      const clonedTicket = await fullCloneTicket(
        ctx.projectId,
        sourceTicket.id,
        'clone-token-saving-branch',
        ++ticketCounter
      );

      expect(clonedTicket.tokenSavingOverride).toBe('FORCE_OFF');
      expect(clonedTicket.jobs).toHaveLength(1);
      expect(clonedTicket.jobs[0]).toMatchObject({
        branch: 'clone-token-saving-branch',
        tokenSavingRequested: true,
        tokenSavingStatus: 'FALLBACK',
        tokenSavingFallbackReason: 'rtk init failed',
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 when ticket not found', async () => {
      const response = await ctx.api.post<{
        error: string;
        code: string;
      }>(`/api/projects/${ctx.projectId}/tickets/999999/duplicate`, {});

      expect(response.status).toBe(404);
      expect(response.data.code).toBe('TICKET_NOT_FOUND');
    });

    it('should return 400 for invalid ticket ID', async () => {
      const response = await ctx.api.post<{
        error: string;
        code: string;
      }>(`/api/projects/${ctx.projectId}/tickets/invalid/duplicate`, {});

      expect(response.status).toBe(400);
      expect(response.data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid mode parameter', async () => {
      const prisma = getPrismaClient();
      const sourceTicket = await prisma.ticket.create({
        data: {
          title: '[e2e] Invalid Mode Test',
          description: 'Test',
          stage: 'INBOX',
          projectId: ctx.projectId,
          ticketNumber: ++ticketCounter,
          ticketKey: `T-${ticketCounter}`,
          workflowType: 'FULL',
        },
      });

      const response = await ctx.api.post<{
        error: string;
        code: string;
      }>(`/api/projects/${ctx.projectId}/tickets/${sourceTicket.id}/duplicate`, {
        mode: 'invalid',
      });

      expect(response.status).toBe(400);
      expect(response.data.code).toBe('VALIDATION_ERROR');
    });
  });
});
