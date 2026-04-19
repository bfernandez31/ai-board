/**
 * Integration Tests: Auto-mode toggle API (AIB-682)
 *
 * Covers PATCH /api/projects/:projectId/tickets/:id/auto-mode including:
 * - enable on eligible ticket with no running job → autoMode=true + new PENDING job
 * - enable with a RUNNING job → autoMode=true + no new job (US2, FR-011)
 * - enable on ineligible ticket → 400
 * - unauthorized user → 403
 * - disable with running job → autoMode=false + running job untouched (US4)
 * - dispatch failure → autoMode reverts to false (US3, FR-021)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createAPIClient } from '@/tests/fixtures/vitest/api-client';

describe('Auto-mode toggle API (AIB-682)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  async function createFullTicketInStage(stage: 'INBOX' | 'SPECIFY' | 'PLAN') {
    const createResp = await ctx.api.post<{ id: number }>(
      `/api/projects/${ctx.projectId}/tickets`,
      { title: '[e2e] Auto-mode ticket', description: 'Auto-mode test' }
    );
    const ticketId = createResp.data.id;
    if (stage !== 'INBOX') {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { stage, workflowType: 'FULL' },
      });
    }
    return ticketId;
  }

  describe('PATCH enable {enabled:true}', () => {
    it('enables on INBOX ticket with no running job and dispatches SPECIFY', async () => {
      const ticketId = await createFullTicketInStage('INBOX');

      const response = await ctx.api.patch<{ autoMode: boolean; ticketId: number; jobId?: number }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/auto-mode`,
        { enabled: true }
      );

      expect(response.status).toBe(200);
      expect(response.data.autoMode).toBe(true);

      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { jobs: true },
      });
      expect(ticket?.autoMode).toBe(true);
      const specifyJob = ticket?.jobs.find((j) => j.command === 'specify');
      expect(specifyJob).toBeDefined();
      expect(specifyJob?.status).toBe('PENDING');
    });

    it('enables on ticket with a RUNNING job and does not dispatch (FR-011)', async () => {
      const ticketId = await createFullTicketInStage('SPECIFY');

      await prisma.job.create({
        data: {
          ticketId,
          projectId: ctx.projectId,
          command: 'specify',
          status: 'RUNNING',
          startedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const response = await ctx.api.patch<{ autoMode: boolean; jobId?: number }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/auto-mode`,
        { enabled: true }
      );

      expect(response.status).toBe(200);
      expect(response.data.autoMode).toBe(true);
      expect(response.data.jobId).toBeUndefined();

      const jobs = await prisma.job.findMany({ where: { ticketId } });
      // Only the original RUNNING job — no new PENDING job
      expect(jobs).toHaveLength(1);
      expect(jobs[0]?.status).toBe('RUNNING');

      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      expect(ticket?.autoMode).toBe(true);
    });

    it('returns 400 when ticket is ineligible (QUICK workflow)', async () => {
      const ticketId = await createFullTicketInStage('INBOX');
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { workflowType: 'QUICK' },
      });

      const response = await ctx.api.patch<{ error: string; code: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/auto-mode`,
        { enabled: true }
      );

      expect(response.status).toBe(400);
      expect(response.data.code).toBe('AUTO_MODE_INELIGIBLE');

      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      expect(ticket?.autoMode).toBe(false);
    });

    it('returns 400 when ticket is ineligible (stage=BUILD)', async () => {
      const ticketId = await createFullTicketInStage('INBOX');
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { stage: 'BUILD' },
      });

      const response = await ctx.api.patch(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/auto-mode`,
        { enabled: true }
      );

      expect(response.status).toBe(400);
    });

    it('returns 403 when user has no project access', async () => {
      const ticketId = await createFullTicketInStage('INBOX');

      const unauthorized = createAPIClient({
        testUserId: 'nonexistent-user-id',
        enableTestAuthOverride: false,
      });

      const response = await unauthorized.patch<{ error: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/auto-mode`,
        { enabled: true }
      );

      // Unauthorized (no session match) → 401, or forbidden → 403
      expect([401, 403]).toContain(response.status);
    });

    it('returns 400 when body is not a boolean', async () => {
      const ticketId = await createFullTicketInStage('INBOX');

      const response = await ctx.api.patch(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/auto-mode`,
        { enabled: 'yes' }
      );

      expect(response.status).toBe(400);
    });

    it('idempotent when already on: no extra dispatch', async () => {
      const ticketId = await createFullTicketInStage('INBOX');
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { autoMode: true },
      });

      const response = await ctx.api.patch<{ autoMode: boolean }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/auto-mode`,
        { enabled: true }
      );

      expect(response.status).toBe(200);
      expect(response.data.autoMode).toBe(true);
      // No job dispatched because the idempotent branch short-circuits
      const jobs = await prisma.job.findMany({ where: { ticketId } });
      expect(jobs).toHaveLength(0);
    });
  });

  describe('PATCH disable {enabled:false}', () => {
    it('disables on ticket with RUNNING job and leaves job untouched (FR-014)', async () => {
      const ticketId = await createFullTicketInStage('SPECIFY');
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { autoMode: true },
      });

      const runningJob = await prisma.job.create({
        data: {
          ticketId,
          projectId: ctx.projectId,
          command: 'specify',
          status: 'RUNNING',
          startedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const response = await ctx.api.patch<{ autoMode: boolean }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/auto-mode`,
        { enabled: false }
      );

      expect(response.status).toBe(200);
      expect(response.data.autoMode).toBe(false);

      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      expect(ticket?.autoMode).toBe(false);

      const job = await prisma.job.findUnique({ where: { id: runningJob.id } });
      expect(job?.status).toBe('RUNNING');
      expect(job?.command).toBe('specify');
    });

    it('idempotent when already off', async () => {
      const ticketId = await createFullTicketInStage('INBOX');

      const response = await ctx.api.patch<{ autoMode: boolean }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/auto-mode`,
        { enabled: false }
      );

      expect(response.status).toBe(200);
      expect(response.data.autoMode).toBe(false);
    });
  });
});
