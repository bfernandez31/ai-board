/**
 * Integration Tests: Project apply-smart-defaults endpoint (AIB-678)
 *
 * Covers POST /api/projects/:projectId/model-config/apply-smart-defaults.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Agent } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { SMART_DEFAULTS } from '@/lib/models/claude-models';
import { CODEX_SMART_DEFAULTS } from '@/lib/models/codex-models';

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

describe('POST /apply-smart-defaults — Codex', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: {
        defaultAgent: Agent.CODEX,
        codexSpecifyModel: null,
        codexPlanModel: null,
        codexImplementModel: null,
        codexQuickImplModel: null,
        codexVerifyModel: null,
      },
    });
  });

  it('writes all 5 codex*Model columns to CODEX_SMART_DEFAULTS when defaultAgent is CODEX', async () => {
    const response = await ctx.api.post<{
      codexSpecifyModel: string | null;
      codexPlanModel: string | null;
      codexImplementModel: string | null;
      codexQuickImplModel: string | null;
      codexVerifyModel: string | null;
    }>(`/api/projects/${ctx.projectId}/model-config/apply-smart-defaults`, {});

    expect(response.status).toBe(200);
    expect(response.data).toEqual(CODEX_SMART_DEFAULTS);

    const db = await prisma.project.findUnique({ where: { id: ctx.projectId } });
    expect(db?.codexSpecifyModel).toBe(CODEX_SMART_DEFAULTS.codexSpecifyModel);
    expect(db?.codexPlanModel).toBe(CODEX_SMART_DEFAULTS.codexPlanModel);
    expect(db?.codexImplementModel).toBe(CODEX_SMART_DEFAULTS.codexImplementModel);
    expect(db?.codexQuickImplModel).toBe(CODEX_SMART_DEFAULTS.codexQuickImplModel);
    expect(db?.codexVerifyModel).toBe(CODEX_SMART_DEFAULTS.codexVerifyModel);
  });

  it('is idempotent: a second call yields identical Codex state', async () => {
    await ctx.api.post(`/api/projects/${ctx.projectId}/model-config/apply-smart-defaults`, {});
    const second = await ctx.api.post<Record<string, string>>(
      `/api/projects/${ctx.projectId}/model-config/apply-smart-defaults`,
      {}
    );

    expect(second.status).toBe(200);
    expect(second.data).toEqual(CODEX_SMART_DEFAULTS);
  });

  it('allows a project member (non-owner) to apply Codex smart defaults', async () => {
    const member = await ctx.createUser(`codex-member-${Date.now()}@project${ctx.projectId}.e2e.test`);
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
    expect(response.data).toEqual(CODEX_SMART_DEFAULTS);
  });

  it('returns 404 for a non-member unrelated user', async () => {
    const outsider = await ctx.createUser(`codex-outsider-${Date.now()}@e2e.local`);

    const response = await ctx.api.post<{ error: string }>(
      `/api/projects/${ctx.projectId}/model-config/apply-smart-defaults`,
      {},
      { headers: { 'x-test-user-id': outsider.id } }
    );

    expect(response.status).toBe(404);
  });

  it('returns 400 UNSUPPORTED_AGENT_FOR_SMART_DEFAULTS when defaultAgent is MISTRAL', async () => {
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { defaultAgent: Agent.MISTRAL },
    });

    const response = await ctx.api.post<{ error: string; code: string }>(
      `/api/projects/${ctx.projectId}/model-config/apply-smart-defaults`,
      {}
    );

    expect(response.status).toBe(400);
    expect(response.data?.code).toBe('UNSUPPORTED_AGENT_FOR_SMART_DEFAULTS');
  });

  it('returns 400 UNSUPPORTED_AGENT_FOR_SMART_DEFAULTS when defaultAgent is GEMINI', async () => {
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { defaultAgent: Agent.GEMINI },
    });

    const response = await ctx.api.post<{ error: string; code: string }>(
      `/api/projects/${ctx.projectId}/model-config/apply-smart-defaults`,
      {}
    );

    expect(response.status).toBe(400);
    expect(response.data?.code).toBe('UNSUPPORTED_AGENT_FOR_SMART_DEFAULTS');
  });
});

describe('agent-switch dormancy (AIB-830 US3)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    // Start with explicit Claude per-stage models set, defaultAgent CLAUDE,
    // and Codex columns null.
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: {
        defaultAgent: Agent.CLAUDE,
        specifyModel: 'claude-opus-4-7',
        planModel: 'claude-opus-4-7',
        implementModel: 'claude-sonnet-4-6',
        quickImplModel: 'claude-sonnet-4-6',
        verifyModel: 'claude-sonnet-4-6',
        codexSpecifyModel: null,
        codexPlanModel: null,
        codexImplementModel: null,
        codexQuickImplModel: null,
        codexVerifyModel: null,
      },
    });
  });

  it('switching CLAUDE→CODEX, applying Codex smart defaults, switching back preserves Claude columns', async () => {
    // Step 1: Switch defaultAgent to CODEX (no Codex fields in same body).
    const switchToCodex = await ctx.api.patch<{ defaultAgent: string }>(
      `/api/projects/${ctx.projectId}`,
      { defaultAgent: 'CODEX' }
    );
    expect(switchToCodex.status).toBe(200);

    // Claude columns intact after switch.
    let db = await prisma.project.findUnique({ where: { id: ctx.projectId } });
    expect(db?.specifyModel).toBe('claude-opus-4-7');
    expect(db?.planModel).toBe('claude-opus-4-7');
    expect(db?.implementModel).toBe('claude-sonnet-4-6');
    expect(db?.quickImplModel).toBe('claude-sonnet-4-6');
    expect(db?.verifyModel).toBe('claude-sonnet-4-6');

    // Step 2: Apply smart defaults under CODEX.
    const applyCodex = await ctx.api.post<Record<string, string>>(
      `/api/projects/${ctx.projectId}/model-config/apply-smart-defaults`,
      {}
    );
    expect(applyCodex.status).toBe(200);
    expect(applyCodex.data).toEqual(CODEX_SMART_DEFAULTS);

    db = await prisma.project.findUnique({ where: { id: ctx.projectId } });
    // Codex columns populated.
    expect(db?.codexSpecifyModel).toBe(CODEX_SMART_DEFAULTS.codexSpecifyModel);
    expect(db?.codexImplementModel).toBe(CODEX_SMART_DEFAULTS.codexImplementModel);
    // Claude columns still intact.
    expect(db?.specifyModel).toBe('claude-opus-4-7');
    expect(db?.implementModel).toBe('claude-sonnet-4-6');

    // Step 3: Switch back to CLAUDE.
    const switchBack = await ctx.api.patch<{ defaultAgent: string }>(
      `/api/projects/${ctx.projectId}`,
      { defaultAgent: 'CLAUDE' }
    );
    expect(switchBack.status).toBe(200);

    db = await prisma.project.findUnique({ where: { id: ctx.projectId } });
    // Claude still intact.
    expect(db?.specifyModel).toBe('claude-opus-4-7');
    expect(db?.implementModel).toBe('claude-sonnet-4-6');
    // Codex columns still populated (dormant but retained).
    expect(db?.codexSpecifyModel).toBe(CODEX_SMART_DEFAULTS.codexSpecifyModel);
    expect(db?.codexImplementModel).toBe(CODEX_SMART_DEFAULTS.codexImplementModel);
  });
});
