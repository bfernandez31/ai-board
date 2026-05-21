/**
 * Integration Tests: Bulk delete INBOX tickets (AIB-820 US1)
 *
 * Covers: POST /api/projects/:projectId/tickets/bulk/delete
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createAPIClient } from '@/tests/fixtures/vitest/api-client';

describe('POST /api/projects/:projectId/tickets/bulk/delete (AIB-820)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  async function createInboxTicket(title: string) {
    const resp = await ctx.api.post<{ id: number; version: number }>(
      `/api/projects/${ctx.projectId}/tickets`,
      { title: `[e2e] ${title}`, description: 'bulk delete fixture' },
    );
    return { id: resp.data.id, version: resp.data.version };
  }

  it('deletes every selected INBOX ticket and reports them in affected[]', async () => {
    const t1 = await createInboxTicket('bd-1');
    const t2 = await createInboxTicket('bd-2');
    const t3 = await createInboxTicket('bd-3');

    const resp = await ctx.api.post<{ affected: number[]; skipped: unknown[]; prsClosed: number }>(
      `/api/projects/${ctx.projectId}/tickets/bulk/delete`,
      { tickets: [t1, t2, t3] },
    );

    expect(resp.status).toBe(200);
    expect(resp.data.affected.sort((a, b) => a - b)).toEqual([t1.id, t2.id, t3.id].sort((a, b) => a - b));
    expect(resp.data.skipped).toEqual([]);
    expect(resp.data.prsClosed).toBe(0);

    const remaining = await prisma.ticket.findMany({ where: { id: { in: [t1.id, t2.id, t3.id] } } });
    expect(remaining).toHaveLength(0);
  });

  it('reports VERSION_CONFLICT when the supplied version is stale', async () => {
    const t1 = await createInboxTicket('bd-vc-1');
    const t2 = await createInboxTicket('bd-vc-2');
    await prisma.ticket.update({ where: { id: t1.id }, data: { version: { increment: 1 } } });

    const resp = await ctx.api.post<{ affected: number[]; skipped: { ticketId: number; reason: string }[] }>(
      `/api/projects/${ctx.projectId}/tickets/bulk/delete`,
      { tickets: [t1, t2] },
    );

    expect(resp.status).toBe(200);
    expect(resp.data.affected).toEqual([t2.id]);
    expect(resp.data.skipped).toEqual([{ ticketId: t1.id, reason: 'VERSION_CONFLICT' }]);

    const stillThere = await prisma.ticket.findUnique({ where: { id: t1.id } });
    expect(stillThere).not.toBeNull();
  });

  it('reports NOT_IN_INBOX when the ticket has transitioned out', async () => {
    const t1 = await createInboxTicket('bd-not-inbox');
    await prisma.ticket.update({ where: { id: t1.id }, data: { stage: 'SPECIFY' } });

    const resp = await ctx.api.post<{ affected: number[]; skipped: { ticketId: number; reason: string }[] }>(
      `/api/projects/${ctx.projectId}/tickets/bulk/delete`,
      { tickets: [t1] },
    );

    expect(resp.status).toBe(200);
    expect(resp.data.affected).toEqual([]);
    expect(resp.data.skipped).toEqual([{ ticketId: t1.id, reason: 'NOT_IN_INBOX' }]);
  });

  it('treats ids belonging to other projects as NOT_FOUND', async () => {
    const t1 = await createInboxTicket('bd-foreign');

    const resp = await ctx.api.post<{ affected: number[]; skipped: { ticketId: number; reason: string }[] }>(
      `/api/projects/${ctx.projectId}/tickets/bulk/delete`,
      { tickets: [t1, { id: 999_999, version: 1 }] },
    );

    expect(resp.status).toBe(200);
    expect(resp.data.affected).toEqual([t1.id]);
    expect(resp.data.skipped).toEqual([{ ticketId: 999_999, reason: 'NOT_FOUND' }]);
  });

  it('returns 400 when the tickets array is empty', async () => {
    const resp = await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/bulk/delete`, { tickets: [] });
    expect(resp.status).toBe(400);
  });

  it('returns 400 when the tickets array exceeds the 50-ticket cap', async () => {
    const tickets = Array.from({ length: 51 }, (_, i) => ({ id: i + 1, version: 1 }));
    const resp = await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/bulk/delete`, { tickets });
    expect(resp.status).toBe(400);
  });

  it('returns 401 when no authentication is supplied', async () => {
    const anon = createAPIClient({ includeTestUserHeader: false, enableTestAuthOverride: false });
    const resp = await anon.post(`/api/projects/${ctx.projectId}/tickets/bulk/delete`, {
      tickets: [{ id: 1, version: 1 }],
    });
    expect(resp.status).toBe(401);
  });
});
