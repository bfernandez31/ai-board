import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

describe('POST /api/projects/:projectId/tickets/bulk', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  async function createInboxTicket(title: string) {
    const res = await ctx.api.post<{ id: number; ticketKey: string }>(
      `/api/projects/${ctx.projectId}/tickets`,
      { title, description: '[e2e] bulk test ticket' }
    );
    return res.data;
  }

  async function createInboxTicketWithJob(title: string, jobStatus: 'PENDING' | 'RUNNING') {
    const ticket = await createInboxTicket(title);
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        command: 'specify',
        status: jobStatus,
        model: 'test',
      },
    });
    return ticket;
  }

  describe('action: delete', () => {
    it('should delete multiple INBOX tickets', async () => {
      const t1 = await createInboxTicket('[e2e] bulk-delete-1');
      const t2 = await createInboxTicket('[e2e] bulk-delete-2');
      const t3 = await createInboxTicket('[e2e] bulk-delete-3');

      const res = await ctx.api.post<{
        action: string;
        results: { succeeded: Array<{ ticketId: number }>; skipped: Array<{ ticketId: number }> };
        summary: { total: number; succeeded: number; skipped: number };
      }>(`/api/projects/${ctx.projectId}/tickets/bulk`, {
        action: 'delete',
        ticketIds: [t1.id, t2.id, t3.id],
      });

      expect(res.status).toBe(200);
      expect(res.data.action).toBe('delete');
      expect(res.data.summary.total).toBe(3);
      expect(res.data.summary.succeeded).toBe(3);
      expect(res.data.summary.skipped).toBe(0);
      expect(res.data.results.succeeded).toHaveLength(3);

      const remaining = await prisma.ticket.findMany({
        where: { id: { in: [t1.id, t2.id, t3.id] } },
      });
      expect(remaining).toHaveLength(0);
    });

    it('should skip tickets with active jobs', async () => {
      const t1 = await createInboxTicket('[e2e] bulk-delete-ok');
      const t2 = await createInboxTicketWithJob('[e2e] bulk-delete-active', 'RUNNING');

      const res = await ctx.api.post<{
        action: string;
        results: { succeeded: Array<{ ticketId: number }>; skipped: Array<{ ticketId: number; reason: string }> };
        summary: { total: number; succeeded: number; skipped: number };
      }>(`/api/projects/${ctx.projectId}/tickets/bulk`, {
        action: 'delete',
        ticketIds: [t1.id, t2.id],
      });

      expect(res.status).toBe(200);
      expect(res.data.summary.succeeded).toBe(1);
      expect(res.data.summary.skipped).toBe(1);
      expect(res.data.results.skipped[0]?.reason).toContain('active job');

      const activeTicket = await prisma.ticket.findUnique({ where: { id: t2.id } });
      expect(activeTicket).not.toBeNull();
    });

    it('should skip tickets not found or not in INBOX', async () => {
      const t1 = await createInboxTicket('[e2e] bulk-delete-inbox');
      await prisma.ticket.update({ where: { id: t1.id }, data: { stage: 'SPECIFY' } });

      const res = await ctx.api.post<{
        summary: { total: number; succeeded: number; skipped: number };
      }>(`/api/projects/${ctx.projectId}/tickets/bulk`, {
        action: 'delete',
        ticketIds: [t1.id, 999999],
      });

      expect(res.status).toBe(200);
      expect(res.data.summary.succeeded).toBe(0);
      expect(res.data.summary.skipped).toBe(2);
    });

    it('should cascade delete jobs and comments', async () => {
      const t1 = await createInboxTicket('[e2e] bulk-delete-cascade');
      await prisma.job.create({
        data: { ticketId: t1.id, command: 'specify', status: 'COMPLETED', model: 'test' },
      });
      await prisma.comment.create({
        data: { ticketId: t1.id, content: 'test comment', authorId: 'test-user-id' },
      });

      const res = await ctx.api.post<{
        summary: { succeeded: number };
      }>(`/api/projects/${ctx.projectId}/tickets/bulk`, {
        action: 'delete',
        ticketIds: [t1.id],
      });

      expect(res.data.summary.succeeded).toBe(1);
      const jobs = await prisma.job.findMany({ where: { ticketId: t1.id } });
      const comments = await prisma.comment.findMany({ where: { ticketId: t1.id } });
      expect(jobs).toHaveLength(0);
      expect(comments).toHaveLength(0);
    });

    it('should return 400 for empty ticketIds', async () => {
      const res = await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/bulk`, {
        action: 'delete',
        ticketIds: [],
      });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid payload', async () => {
      const res = await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/bulk`, {
        action: 'delete',
      });
      expect(res.status).toBe(400);
    });

    it('should require authentication', async () => {
      const res = await ctx.api.post(
        `/api/projects/${ctx.projectId}/tickets/bulk`,
        { action: 'delete', ticketIds: [1] },
        { enableTestAuthOverride: false, includeTestUserHeader: false }
      );
      expect(res.status).toBe(401);
    });
  });
});
