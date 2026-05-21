/**
 * Integration tests: Atomic fusion of INBOX tickets (AIB-820 US3)
 * Covers: POST /api/projects/:projectId/tickets/bulk/fusion
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createAPIClient } from '@/tests/fixtures/vitest/api-client';

describe('POST /api/projects/:projectId/tickets/bulk/fusion (AIB-820)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  async function createInbox(title: string) {
    const resp = await ctx.api.post<{ id: number; version: number; ticketKey: string }>(
      `/api/projects/${ctx.projectId}/tickets`,
      { title: `[e2e] ${title}`, description: 'fusion fixture' },
    );
    return { id: resp.data.id, version: resp.data.version, ticketKey: resp.data.ticketKey };
  }

  it('atomically updates the anchor and deletes absorbed tickets', async () => {
    const a = await createInbox('fu-anchor');
    const b = await createInbox('fu-b');
    const c = await createInbox('fu-c');

    const resp = await ctx.api.post<{ anchor: { id: number; version: number }; deletedIds: number[] }>(
      `/api/projects/${ctx.projectId}/tickets/bulk/fusion`,
      {
        anchorId: a.id,
        anchorVersion: a.version,
        title: '[e2e] fused title',
        description: 'fused body',
        attachments: [],
        absorbed: [
          { id: b.id, version: b.version },
          { id: c.id, version: c.version },
        ],
      },
    );

    expect(resp.status).toBe(200);
    expect(resp.data.anchor.id).toBe(a.id);
    expect(resp.data.anchor.version).toBeGreaterThan(a.version);
    expect(resp.data.deletedIds.sort()).toEqual([b.id, c.id].sort());

    const anchor = await prisma.ticket.findUnique({ where: { id: a.id } });
    expect(anchor?.title).toBe('[e2e] fused title');
    expect(anchor?.description).toBe('fused body');
    const remaining = await prisma.ticket.findMany({ where: { id: { in: [b.id, c.id] } } });
    expect(remaining).toHaveLength(0);
  });

  it('returns 409 with conflicting ids and rolls back when an absorbed version is stale', async () => {
    const a = await createInbox('fu-conflict-a');
    const b = await createInbox('fu-conflict-b');
    await prisma.ticket.update({ where: { id: b.id }, data: { version: { increment: 1 } } });

    const resp = await ctx.api.post<{ code?: string; conflicting?: number[] }>(
      `/api/projects/${ctx.projectId}/tickets/bulk/fusion`,
      {
        anchorId: a.id,
        anchorVersion: a.version,
        title: '[e2e] fused',
        description: 'fused body',
        attachments: [],
        absorbed: [{ id: b.id, version: b.version }],
      },
    );

    expect(resp.status).toBe(409);
    expect(resp.data.code).toBe('CONFLICT');
    expect(resp.data.conflicting).toContain(b.id);

    const rows = await prisma.ticket.findMany({ where: { id: { in: [a.id, b.id] } } });
    expect(rows).toHaveLength(2);
    const anchorRow = rows.find((r) => r.id === a.id)!;
    expect(anchorRow.version).toBe(a.version);
    expect(anchorRow.description).toBe('fusion fixture');
  });

  it('returns 400 when description exceeds 10000 chars', async () => {
    const a = await createInbox('fu-long-a');
    const b = await createInbox('fu-long-b');
    const resp = await ctx.api.post(
      `/api/projects/${ctx.projectId}/tickets/bulk/fusion`,
      {
        anchorId: a.id,
        anchorVersion: a.version,
        title: '[e2e] too long',
        description: 'x'.repeat(10_001),
        attachments: [],
        absorbed: [{ id: b.id, version: b.version }],
      },
    );
    expect(resp.status).toBe(400);
  });

  it('returns 400 when anchorId appears in absorbed', async () => {
    const a = await createInbox('fu-self');
    const resp = await ctx.api.post(
      `/api/projects/${ctx.projectId}/tickets/bulk/fusion`,
      {
        anchorId: a.id,
        anchorVersion: a.version,
        title: '[e2e] self',
        description: 'fused',
        attachments: [],
        absorbed: [{ id: a.id, version: a.version }],
      },
    );
    expect(resp.status).toBe(400);
  });

  it('returns 400 when total ids exceed 50', async () => {
    const a = await createInbox('fu-cap-a');
    const absorbed = Array.from({ length: 50 }, (_, i) => ({ id: 1000 + i, version: 1 }));
    const resp = await ctx.api.post(
      `/api/projects/${ctx.projectId}/tickets/bulk/fusion`,
      {
        anchorId: a.id,
        anchorVersion: a.version,
        title: '[e2e] cap',
        description: 'fused',
        attachments: [],
        absorbed,
      },
    );
    expect(resp.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const anon = createAPIClient({ includeTestUserHeader: false, enableTestAuthOverride: false });
    const resp = await anon.post(
      `/api/projects/${ctx.projectId}/tickets/bulk/fusion`,
      {
        anchorId: 1,
        anchorVersion: 1,
        title: 'x',
        description: 'x',
        attachments: [],
        absorbed: [{ id: 2, version: 1 }],
      },
    );
    expect(resp.status).toBe(401);
  });
});
