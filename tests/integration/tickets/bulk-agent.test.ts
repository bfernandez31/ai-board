/**
 * Integration tests: Bulk change agent on INBOX tickets (AIB-820 US2)
 * Covers: POST /api/projects/:projectId/tickets/bulk/agent
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createAPIClient } from '@/tests/fixtures/vitest/api-client';

describe('POST /api/projects/:projectId/tickets/bulk/agent (AIB-820)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  async function createInbox(title: string) {
    const resp = await ctx.api.post<{ id: number; version: number }>(
      `/api/projects/${ctx.projectId}/tickets`,
      { title: `[e2e] ${title}`, description: 'bulk agent fixture' },
    );
    return { id: resp.data.id, version: resp.data.version };
  }

  it('sets the agent on every selected INBOX ticket', async () => {
    const t1 = await createInbox('ba-1');
    const t2 = await createInbox('ba-2');

    const resp = await ctx.api.post<{
      affected: Array<{ ticketId: number; version: number; agent: string | null }>;
      skipped: unknown[];
    }>(`/api/projects/${ctx.projectId}/tickets/bulk/agent`, {
      agent: 'CODEX',
      tickets: [t1, t2],
    });

    expect(resp.status).toBe(200);
    expect(resp.data.affected).toHaveLength(2);
    for (const a of resp.data.affected) {
      expect(a.agent).toBe('CODEX');
      expect(a.version).toBeGreaterThan(0);
    }
    expect(resp.data.skipped).toEqual([]);

    const rows = await prisma.ticket.findMany({ where: { id: { in: [t1.id, t2.id] } } });
    for (const r of rows) expect(r.agent).toBe('CODEX');
  });

  it('clears the agent override when agent is null', async () => {
    const t1 = await createInbox('ba-null-1');
    await prisma.ticket.update({ where: { id: t1.id }, data: { agent: 'CODEX' } });
    const refreshed = await prisma.ticket.findUniqueOrThrow({ where: { id: t1.id } });

    const resp = await ctx.api.post<{
      affected: Array<{ ticketId: number; agent: string | null }>;
    }>(`/api/projects/${ctx.projectId}/tickets/bulk/agent`, {
      agent: null,
      tickets: [{ id: t1.id, version: refreshed.version }],
    });

    expect(resp.status).toBe(200);
    expect(resp.data.affected[0]!.agent).toBeNull();
    const row = await prisma.ticket.findUniqueOrThrow({ where: { id: t1.id } });
    expect(row.agent).toBeNull();
  });

  it('reports VERSION_CONFLICT for stale versions', async () => {
    const t1 = await createInbox('ba-vc-1');
    const t2 = await createInbox('ba-vc-2');
    await prisma.ticket.update({ where: { id: t1.id }, data: { version: { increment: 1 } } });

    const resp = await ctx.api.post<{
      affected: Array<{ ticketId: number }>;
      skipped: Array<{ ticketId: number; reason: string }>;
    }>(`/api/projects/${ctx.projectId}/tickets/bulk/agent`, {
      agent: 'GEMINI',
      tickets: [t1, t2],
    });

    expect(resp.status).toBe(200);
    expect(resp.data.affected.map((a) => a.ticketId)).toEqual([t2.id]);
    expect(resp.data.skipped).toEqual([{ ticketId: t1.id, reason: 'VERSION_CONFLICT' }]);
  });

  it('reports NOT_IN_INBOX when stage has transitioned', async () => {
    const t1 = await createInbox('ba-not-inbox');
    await prisma.ticket.update({ where: { id: t1.id }, data: { stage: 'SPECIFY' } });

    const resp = await ctx.api.post<{
      affected: unknown[];
      skipped: Array<{ ticketId: number; reason: string }>;
    }>(`/api/projects/${ctx.projectId}/tickets/bulk/agent`, {
      agent: 'CODEX',
      tickets: [t1],
    });

    expect(resp.status).toBe(200);
    expect(resp.data.affected).toEqual([]);
    expect(resp.data.skipped).toEqual([{ ticketId: t1.id, reason: 'NOT_IN_INBOX' }]);
  });

  it('returns 400 on invalid agent string', async () => {
    const t1 = await createInbox('ba-bad');
    const resp = await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/bulk/agent`, {
      agent: 'NOT_AN_AGENT',
      tickets: [t1],
    });
    expect(resp.status).toBe(400);
  });

  it('returns 400 when more than 50 tickets are supplied', async () => {
    const tickets = Array.from({ length: 51 }, (_, i) => ({ id: i + 1, version: 1 }));
    const resp = await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/bulk/agent`, {
      agent: 'CLAUDE',
      tickets,
    });
    expect(resp.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const anon = createAPIClient({ includeTestUserHeader: false, enableTestAuthOverride: false });
    const resp = await anon.post(`/api/projects/${ctx.projectId}/tickets/bulk/agent`, {
      agent: 'CLAUDE',
      tickets: [{ id: 1, version: 1 }],
    });
    expect(resp.status).toBe(401);
  });
});
