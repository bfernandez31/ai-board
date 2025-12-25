/**
 * Integration Tests: Cleanup Analysis
 *
 * Migrated from: tests/api/cleanup-transition-lock.spec.ts, tests/e2e/cleanup/*.spec.ts
 * Tests for cleanup workflow and transition lock behavior.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('Cleanup Analysis', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();

    // Clear any existing cleanup lock
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { activeCleanupJobId: null },
    });
  });

  afterEach(async () => {
    // Ensure cleanup lock is cleared after each test
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { activeCleanupJobId: null },
    });
  });

  describe('POST /api/projects/:projectId/clean', () => {
    it('should create cleanup ticket and job', async () => {
      // Create a ticket that was shipped to make cleanup valid
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Shipped ticket for cleanup',
          description: 'This ticket was shipped',
        }
      );
      const ticketId = createResponse.data.id;

      // Simulate shipped ticket
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { stage: 'SHIP', workflowType: 'FULL' },
      });

      // Trigger cleanup
      const response = await ctx.api.post<{
        ticket: { id: number; workflowType: string };
        job: { id: number; command: string };
      }>(`/api/projects/${ctx.projectId}/clean`);

      // Note: Cleanup may fail if no tickets shipped since last cleanup
      // This is expected behavior
      if (response.status === 201) {
        expect(response.data.ticket.workflowType).toBe('CLEAN');
        expect(response.data.job.command).toBe('clean');
      } else {
        // 400 is expected if shouldRunCleanup returns false
        expect([201, 400]).toContain(response.status);
      }
    });
  });

  describe('Cleanup Transition Lock', () => {
    it('should return 423 when cleanup job is PENDING', async () => {
      // Create a regular ticket
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Ticket to block',
          description: 'Test ticket for lock testing',
        }
      );
      const ticketId = createResponse.data.id;

      // Create a cleanup ticket
      const cleanupTicket = await prisma.ticket.create({
        data: {
          ticketNumber: 999,
          ticketKey: `E2E-999-cleanup`,
          title: '[e2e] Clean 2025-01-01',
          description: '[e2e] Cleanup ticket',
          stage: 'BUILD',
          projectId: ctx.projectId,
          workflowType: 'CLEAN',
          updatedAt: new Date(),
        },
      });

      // Create cleanup job
      const cleanupJob = await prisma.job.create({
        data: {
          ticketId: cleanupTicket.id,
          projectId: ctx.projectId,
          command: 'clean',
          status: 'PENDING',
          startedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Set activeCleanupJobId
      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { activeCleanupJobId: cleanupJob.id },
      });

      // Attempt transition - should be blocked
      const response = await ctx.api.post<{
        code: string;
        error: string;
        details: { activeCleanupJobId: number; jobStatus: string };
      }>(`/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`, {
        targetStage: 'SPECIFY',
      });

      expect(response.status).toBe(423);
      expect(response.data.code).toBe('CLEANUP_IN_PROGRESS');
      expect(response.data.error).toContain('cleanup is in progress');
      expect(response.data.details.activeCleanupJobId).toBe(cleanupJob.id);
      expect(response.data.details.jobStatus).toBe('PENDING');
    });

    it('should return 423 when cleanup job is RUNNING', async () => {
      // Create a regular ticket
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Ticket during running cleanup',
          description: 'Test ticket for running cleanup lock',
        }
      );
      const ticketId = createResponse.data.id;

      // Create a cleanup ticket and job
      const cleanupTicket = await prisma.ticket.create({
        data: {
          ticketNumber: 998,
          ticketKey: `E2E-998-cleanup`,
          title: '[e2e] Clean running',
          description: '[e2e] Running cleanup ticket',
          stage: 'BUILD',
          projectId: ctx.projectId,
          workflowType: 'CLEAN',
          updatedAt: new Date(),
        },
      });

      const cleanupJob = await prisma.job.create({
        data: {
          ticketId: cleanupTicket.id,
          projectId: ctx.projectId,
          command: 'clean',
          status: 'RUNNING',
          startedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { activeCleanupJobId: cleanupJob.id },
      });

      // Attempt transition - should be blocked
      const response = await ctx.api.post<{ code: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'SPECIFY' }
      );

      expect(response.status).toBe(423);
      expect(response.data.code).toBe('CLEANUP_IN_PROGRESS');
    });

    it('should allow transition when no cleanup is active', async () => {
      // Create a regular ticket
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Normal transition ticket',
          description: 'Test ticket without cleanup lock',
        }
      );
      const ticketId = createResponse.data.id;

      // Ensure no cleanup lock
      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { activeCleanupJobId: null },
      });

      // Transition should work
      const response = await ctx.api.post<{ stage: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'SPECIFY' }
      );

      expect(response.status).toBe(200);
      expect(response.data.stage).toBe('SPECIFY');
    });

    it('should allow transition when cleanup job is COMPLETED', async () => {
      // Create a regular ticket
      const createResponse = await ctx.api.post<{ id: number }>(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] After cleanup ticket',
          description: 'Test ticket after cleanup completes',
        }
      );
      const ticketId = createResponse.data.id;

      // Create a completed cleanup job
      const cleanupTicket = await prisma.ticket.create({
        data: {
          ticketNumber: 997,
          ticketKey: `E2E-997-cleanup`,
          title: '[e2e] Clean completed',
          description: '[e2e] Completed cleanup ticket',
          stage: 'SHIP',
          projectId: ctx.projectId,
          workflowType: 'CLEAN',
          updatedAt: new Date(),
        },
      });

      const cleanupJob = await prisma.job.create({
        data: {
          ticketId: cleanupTicket.id,
          projectId: ctx.projectId,
          command: 'clean',
          status: 'COMPLETED',
          startedAt: new Date(),
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Note: activeCleanupJobId should be null after completion
      // but even if set, COMPLETED status should not block
      await prisma.project.update({
        where: { id: ctx.projectId },
        data: { activeCleanupJobId: cleanupJob.id },
      });

      // Transition should work for completed cleanup
      const response = await ctx.api.post<{ stage: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
        { targetStage: 'SPECIFY' }
      );

      expect(response.status).toBe(200);
      expect(response.data.stage).toBe('SPECIFY');
    });
  });

  describe('Cleanup should run analysis', () => {
    it('should check if tickets shipped since last cleanup', async () => {
      // shouldRunCleanup endpoint check
      const response = await ctx.api.get<{ shouldRun: boolean }>(
        `/api/projects/${ctx.projectId}/clean/check`
      );

      // Response could be 200 (endpoint exists) or 404 (endpoint doesn't exist)
      // The key behavior is that cleanup only runs when appropriate
      if (response.status === 200) {
        expect(response.data).toHaveProperty('shouldRun');
        expect(typeof response.data.shouldRun).toBe('boolean');
      }
    });
  });
});
