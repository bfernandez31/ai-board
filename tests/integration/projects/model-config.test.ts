/**
 * Integration Tests: Project apply-smart-defaults endpoint (AIB-678)
 *
 * Covers POST /api/projects/:projectId/model-config/apply-smart-defaults.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { SMART_DEFAULTS } from '@/lib/models/claude-models';

describe('POST /api/projects/:projectId/model-config/apply-smart-defaults', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: {
        specifyModel: null,
        planModel: null,
        implementModel: null,
        quickImplModel: null,
        verifyModel: null,
      },
    });
  });

  it('writes all 5 SMART_DEFAULTS columns atomically', async () => {
    const response = await ctx.api.post<{
      specifyModel: string | null;
      planModel: string | null;
      implementModel: string | null;
      quickImplModel: string | null;
      verifyModel: string | null;
    }>(`/api/projects/${ctx.projectId}/model-config/apply-smart-defaults`, {});

    expect(response.status).toBe(200);
    expect(response.data).toEqual(SMART_DEFAULTS);

    const db = await prisma.project.findUnique({ where: { id: ctx.projectId } });
    expect(db?.specifyModel).toBe(SMART_DEFAULTS.specifyModel);
    expect(db?.planModel).toBe(SMART_DEFAULTS.planModel);
    expect(db?.implementModel).toBe(SMART_DEFAULTS.implementModel);
    expect(db?.quickImplModel).toBe(SMART_DEFAULTS.quickImplModel);
    expect(db?.verifyModel).toBe(SMART_DEFAULTS.verifyModel);
  });

  it('is idempotent: a second call yields identical state', async () => {
    await ctx.api.post(`/api/projects/${ctx.projectId}/model-config/apply-smart-defaults`, {});
    const second = await ctx.api.post<Record<string, string>>(
      `/api/projects/${ctx.projectId}/model-config/apply-smart-defaults`,
      {}
    );

    expect(second.status).toBe(200);
    expect(second.data).toEqual(SMART_DEFAULTS);
  });

  it('allows a project member (non-owner) to apply smart defaults', async () => {
    const member = await ctx.createUser(`member-${Date.now()}@project${ctx.projectId}.e2e.test`);
    await prisma.projectMember.create({
      data: {
        projectId: ctx.projectId,
        userId: member.id,
        role: 'member',
      },
    });

    const response = await ctx.api.post<Record<string, string>>(
      `/api/projects/${ctx.projectId}/model-config/apply-smart-defaults`,
      {},
      { headers: { 'x-test-user-id': member.id } }
    );

    expect(response.status).toBe(200);
    expect(response.data).toEqual(SMART_DEFAULTS);
  });

  it('returns 404 for a non-member unrelated user', async () => {
    const outsider = await ctx.createUser(`outsider-${Date.now()}@e2e.local`);

    const response = await ctx.api.post<{ error: string }>(
      `/api/projects/${ctx.projectId}/model-config/apply-smart-defaults`,
      {},
      { headers: { 'x-test-user-id': outsider.id } }
    );

    expect(response.status).toBe(404);
  });
});
