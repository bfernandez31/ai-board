/**
 * Integration tests: Bulk per-stage model override on INBOX tickets (AIB-820 US2)
 * Covers: POST /api/projects/:projectId/tickets/bulk/model
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createAPIClient } from '@/tests/fixtures/vitest/api-client';

describe('POST /api/projects/:projectId/tickets/bulk/model (AIB-820)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  async function createInbox(title: string) {
    const resp = await ctx.api.post<{ id: number; version: number }>(
      `/api/projects/${ctx.projectId}/tickets`,
      { title: `[e2e] ${title}`, description: 'bulk model fixture' },
    );
    return { id: resp.data.id, version: resp.data.version };
  }

  it('sets a single stage model and leaves the other four untouched', async () => {
    const t1 = await createInbox('bm-1');
    const t2 = await createInbox('bm-2');

    const resp = await ctx.api.post<{
      affected: Array<{
        ticketId: number;
        version: number;
        specifyModel: string | null;
        planModel: string | null;
        implementModel: string | null;
        quickImplModel: string | null;
        verifyModel: string | null;
      }>;
    }>(`/api/projects/${ctx.projectId}/tickets/bulk/model`, {
      stage: 'implementModel',
      model: 'claude-opus-4-7',
      tickets: [t1, t2],
    });

    expect(resp.status).toBe(200);
    expect(resp.data.affected).toHaveLength(2);
    for (const a of resp.data.affected) {
      expect(a.implementModel).toBe('claude-opus-4-7');
      expect(a.specifyModel).toBeNull();
      expect(a.planModel).toBeNull();
      expect(a.quickImplModel).toBeNull();
      expect(a.verifyModel).toBeNull();
    }
  });

  it('clears the stage override when model is null', async () => {
    const t1 = await createInbox('bm-null-1');
    await prisma.ticket.update({ where: { id: t1.id }, data: { specifyModel: 'claude-opus-4-7' } });
    const refreshed = await prisma.ticket.findUniqueOrThrow({ where: { id: t1.id } });

    const resp = await ctx.api.post<{
      affected: Array<{ specifyModel: string | null }>;
    }>(`/api/projects/${ctx.projectId}/tickets/bulk/model`, {
      stage: 'specifyModel',
      model: null,
      tickets: [{ id: t1.id, version: refreshed.version }],
    });

    expect(resp.status).toBe(200);
    expect(resp.data.affected[0]!.specifyModel).toBeNull();
  });

  it('returns 400 INVALID_MODEL_ID for non-Claude model id', async () => {
    const t1 = await createInbox('bm-bad-model');
    const resp = await ctx.api.post<{ error: string; code?: string }>(
      `/api/projects/${ctx.projectId}/tickets/bulk/model`,
      { stage: 'specifyModel', model: 'gpt-not-claude', tickets: [t1] },
    );
    expect(resp.status).toBe(400);
    expect(resp.data.code).toBe('INVALID_MODEL_ID');
  });

  it('returns 400 when stage is missing', async () => {
    const t1 = await createInbox('bm-no-stage');
    const resp = await ctx.api.post(`/api/projects/${ctx.projectId}/tickets/bulk/model`, {
      model: 'claude-opus-4-7',
      tickets: [t1],
    });
    expect(resp.status).toBe(400);
  });

  it('reports per-ticket VERSION_CONFLICT and NOT_IN_INBOX', async () => {
    const t1 = await createInbox('bm-vc');
    const t2 = await createInbox('bm-not-inbox');
    await prisma.ticket.update({ where: { id: t1.id }, data: { version: { increment: 1 } } });
    await prisma.ticket.update({ where: { id: t2.id }, data: { stage: 'SPECIFY' } });
    const t3 = await createInbox('bm-ok');

    const resp = await ctx.api.post<{
      affected: Array<{ ticketId: number }>;
      skipped: Array<{ ticketId: number; reason: string }>;
    }>(`/api/projects/${ctx.projectId}/tickets/bulk/model`, {
      stage: 'planModel',
      model: 'claude-sonnet-4-6',
      tickets: [t1, t2, t3],
    });

    expect(resp.status).toBe(200);
    expect(resp.data.affected.map((a) => a.ticketId)).toEqual([t3.id]);
    const reasons = new Map(resp.data.skipped.map((s) => [s.ticketId, s.reason]));
    expect(reasons.get(t1.id)).toBe('VERSION_CONFLICT');
    expect(reasons.get(t2.id)).toBe('NOT_IN_INBOX');
  });

  it('returns 401 without auth', async () => {
    const anon = createAPIClient({ includeTestUserHeader: false, enableTestAuthOverride: false });
    const resp = await anon.post(`/api/projects/${ctx.projectId}/tickets/bulk/model`, {
      stage: 'planModel',
      model: 'claude-opus-4-7',
      tickets: [{ id: 1, version: 1 }],
    });
    expect(resp.status).toBe(401);
  });
});
