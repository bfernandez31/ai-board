/**
 * Integration Tests: Close Ticket
 *
 * Tests for the close ticket API endpoint.
 * Covers successful close, validation errors, and edge cases.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('Close Ticket', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  /**
   * Helper to create a ticket and move it to VERIFY stage
   */
  async function createVerifyTicket(title: string = '[e2e] Close test ticket') {
    // Create a ticket
    const createResponse = await ctx.api.post<{ id: number; stage: string }>(
      `/api/projects/${ctx.projectId}/tickets`,
      {
        title,
        description: 'Test ticket for close testing',
      }
    );
    expect(createResponse.status).toBe(201);
    const ticketId = createResponse.data.id;

    // Move through stages: INBOX → SPECIFY → PLAN → BUILD → VERIFY
    // We need to manually update the stage since workflow jobs won't actually complete in tests
    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        stage: 'VERIFY',
        workflowType: 'FULL',
        version: { increment: 4 }, // Account for stage changes
      },
    });

    // Clear any jobs that might block the close
    await prisma.job.updateMany({
      where: { ticketId },
      data: { status: 'COMPLETED' },
    });

    return ticketId;
  }

  describe('POST /api/projects/:projectId/tickets/:id/close', () => {
    it('should close ticket from VERIFY stage successfully', async () => {
      const ticketId = await createVerifyTicket();

      const response = await ctx.api.post<{
        id: number;
        stage: string;
        closedAt: string;
        version: number;
        prsClosed: number;
      }>(`/api/projects/${ctx.projectId}/tickets/${ticketId}/close`, {});

      expect(response.status).toBe(200);
      expect(response.data.id).toBe(ticketId);
      expect(response.data.stage).toBe('CLOSED');
      expect(response.data.closedAt).toBeDefined();
      expect(response.data.version).toBeGreaterThan(1);
      expect(response.data.prsClosed).toBe(0); // No GitHub integration in tests

      // Verify database state
      const closedTicket = await prisma.ticket.findUnique({
        where: { id: ticketId },
      });

      expect(closedTicket?.stage).toBe('CLOSED');
      expect(closedTicket?.closedAt).not.toBeNull();
    });

    it('should return 400 when closing ticket from INBOX stage', async () => {
      // Create a ticket in INBOX stage
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Invalid close test',
          description: 'Test ticket in INBOX',
        }
      );
      const ticketId = createResponse.data.id;

      const response = await ctx.api.post<{ error: string; code: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/close`,
        {}
      );

      expect(response.status).toBe(400);
      expect(response.data.error).toBe('Can only close tickets in VERIFY stage');
      expect(response.data.code).toBe('INVALID_STAGE');
    });

    it('should return 400 when closing ticket from BUILD stage', async () => {
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] BUILD close test',
          description: 'Test ticket in BUILD',
        }
      );
      const ticketId = createResponse.data.id;

      // Move to BUILD stage
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { stage: 'BUILD', workflowType: 'QUICK' },
      });

      // Clear jobs
      await prisma.job.updateMany({
        where: { ticketId },
        data: { status: 'COMPLETED' },
      });

      const response = await ctx.api.post<{ error: string; code: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/close`,
        {}
      );

      expect(response.status).toBe(400);
      expect(response.data.code).toBe('INVALID_STAGE');
    });

    it('should return 400 when closing ticket with active jobs', async () => {
      const ticketId = await createVerifyTicket();

      // Create an active job
      await prisma.job.create({
        data: {
          ticketId,
          projectId: ctx.projectId,
          command: 'verify',
          status: 'RUNNING',
          updatedAt: new Date(),
        },
      });

      const response = await ctx.api.post<{ error: string; code: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/close`,
        {}
      );

      expect(response.status).toBe(400);
      expect(response.data.error).toBe('Cannot close ticket with active jobs');
      expect(response.data.code).toBe('ACTIVE_JOBS');
    });

    it('should return 423 when closing during cleanup lock', async () => {
      const ticketId = await createVerifyTicket();

      // Create a cleanup job and lock the project
      const cleanupTicket = await prisma.ticket.create({
        data: {
          projectId: ctx.projectId,
          ticketNumber: 9999,
          ticketKey: 'CLEANUP-9999',
          title: '[e2e] Cleanup ticket',
          description: 'Cleanup',
          stage: 'BUILD',
          workflowType: 'CLEAN',
        },
      });

      const cleanupJob = await prisma.job.create({
        data: {
          ticketId: cleanupTicket.id,
          projectId: ctx.projectId,
          command: 'clean',
          status: 'RUNNING',
          updatedAt: new Date(),
        },
      });

      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { activeCleanupJobId: cleanupJob.id },
      });

      const response = await ctx.api.post<{ error: string; code: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/close`,
        {}
      );

      expect(response.status).toBe(423);
      expect(response.data.error).toContain('cleanup is in progress');
      expect(response.data.code).toBe('CLEANUP_LOCKED');

      // Cleanup: release the lock
      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { activeCleanupJobId: null },
      });
    });

    it('should return 404 for non-existent ticket', async () => {
      const response = await ctx.api.post(
        `/api/projects/${ctx.projectId}/tickets/999999/close`,
        {}
      );

      expect(response.status).toBe(404);
    });

    it('should set closedAt timestamp on close', async () => {
      const ticketId = await createVerifyTicket();
      const beforeClose = new Date();

      const response = await ctx.api.post<{ closedAt: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/close`,
        {}
      );

      expect(response.status).toBe(200);

      const closedAt = new Date(response.data.closedAt);
      expect(closedAt.getTime()).toBeGreaterThanOrEqual(beforeClose.getTime());
    });

    it('should increment version on close', async () => {
      const ticketId = await createVerifyTicket();

      const beforeTicket = await prisma.ticket.findUnique({
        where: { id: ticketId },
      });
      const beforeVersion = beforeTicket!.version;

      const response = await ctx.api.post<{ version: number }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/close`,
        {}
      );

      expect(response.status).toBe(200);
      expect(response.data.version).toBe(beforeVersion + 1);
    });
  });
});
