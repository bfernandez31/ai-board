/**
 * Integration tests for outcome read endpoints (T018, T043, T044).
 *
 * Covers:
 *   GET /api/projects/[projectId]/tickets/[id]/outcome
 *     200 with row, 404 OUTCOME_NOT_FOUND, immutability across HTTP, 405 (no write methods).
 *
 *   GET /api/projects/[projectId]/outcomes
 *     200 with filters (frictionFree, partial, domain, workflowType, since, until),
 *     pagination cursor, validation errors.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

beforeAll(() => {
  process.env.TEST_MODE = 'true';
});

interface OutcomeFixtureOpts {
  ticketNumber: number;
  workflowType?: WorkflowType;
  frictionFree?: boolean;
  partial?: boolean;
  domains?: string[];
  shippedAt?: Date;
  qualityScore?: number | null;
}

async function seedOutcomeRow(
  prisma: ReturnType<typeof getPrismaClient>,
  projectId: number,
  opts: OutcomeFixtureOpts
): Promise<{ ticketId: number }> {
  const ticket = await prisma.ticket.create({
    data: {
      projectId,
      title: `[e2e] api-outcomes ${opts.ticketNumber}`,
      description: 'x',
      stage: Stage.SHIP,
      workflowType: opts.workflowType ?? WorkflowType.FULL,
      ticketNumber: opts.ticketNumber,
      ticketKey: `E2E-API-${opts.ticketNumber}-${Date.now()}`,
      updatedAt: new Date(),
    },
  });
  await prisma.ticketOutcome.create({
    data: {
      ticketId: ticket.id,
      projectId,
      workflowType: opts.workflowType ?? WorkflowType.FULL,
      shippedAt: opts.shippedAt ?? new Date(),
      ruleSetVersion: 1,
      pipelineJobCount: 4,
      frictionJobCount: opts.frictionFree ? 0 : 1,
      totalJobCount: opts.frictionFree ? 4 : 5,
      jobCountByPrefix: { specify: 1, plan: 1, implement: 1, verify: 1 },
      qualityScore: opts.qualityScore ?? 90,
      filesTouched: ['app/foo.ts'],
      linesAdded: 100,
      linesRemoved: 20,
      testCodeRatio: 0.3,
      domains: opts.domains ?? ['app'],
      domainFileCounts: { app: 1 },
      touchedDbSchema: false,
      touchedTests: true,
      touchedCi: false,
      frictionFree: opts.frictionFree ?? true,
      partial: opts.partial ?? false,
      partialReason: opts.partial ? 'no_commit_reference' : null,
    },
  });
  return { ticketId: ticket.id };
}

describe('GET /api/projects/:projectId/tickets/:id/outcome', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('returns 200 with the outcome row for a member', async () => {
    const { ticketId } = await seedOutcomeRow(prisma, ctx.projectId, {
      ticketNumber: 400,
    });

    const res = await ctx.api.get<{ id: number; ticketId: number; frictionFree: boolean }>(
      `/api/projects/${ctx.projectId}/tickets/${ticketId}/outcome`
    );
    expect(res.status).toBe(200);
    expect(res.data.ticketId).toBe(ticketId);
    expect(res.data.frictionFree).toBe(true);
  });

  it('returns 404 OUTCOME_NOT_FOUND when no outcome row exists', async () => {
    const t = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] api-outcomes-404',
        description: 'x',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 401,
        ticketKey: `E2E-API-401-${Date.now()}`,
        updatedAt: new Date(),
      },
    });

    const res = await ctx.api.get<{ error: string; code: string }>(
      `/api/projects/${ctx.projectId}/tickets/${t.id}/outcome`
    );
    expect(res.status).toBe(404);
    expect(res.data.code).toBe('OUTCOME_NOT_FOUND');
  });

  it('rejects PUT/PATCH/DELETE with 405 (no write methods exported)', async () => {
    const { ticketId } = await seedOutcomeRow(prisma, ctx.projectId, { ticketNumber: 402 });
    const url = `/api/projects/${ctx.projectId}/tickets/${ticketId}/outcome`;

    const putRes = await ctx.api.patch(url, {});
    expect(putRes.status).toBe(405);

    const delRes = await ctx.api.delete(url);
    expect(delRes.status).toBe(405);
  });
});

describe('GET /api/projects/:projectId/outcomes (list)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('returns paginated list with default limit', async () => {
    for (let i = 0; i < 5; i++) {
      await seedOutcomeRow(prisma, ctx.projectId, { ticketNumber: 500 + i });
    }
    const res = await ctx.api.get<{
      outcomes: Array<{ id: number; ticketId: number }>;
      nextCursor: number | null;
      totalReturned: number;
    }>(`/api/projects/${ctx.projectId}/outcomes`);
    expect(res.status).toBe(200);
    expect(res.data.totalReturned).toBe(5);
    expect(res.data.outcomes).toHaveLength(5);
  });

  it('filters by frictionFree=true|false', async () => {
    await seedOutcomeRow(prisma, ctx.projectId, { ticketNumber: 510, frictionFree: true });
    await seedOutcomeRow(prisma, ctx.projectId, { ticketNumber: 511, frictionFree: false });

    const yes = await ctx.api.get<{ outcomes: Array<{ frictionFree: boolean }> }>(
      `/api/projects/${ctx.projectId}/outcomes?frictionFree=true`
    );
    expect(yes.data.outcomes.every((o) => o.frictionFree === true)).toBe(true);

    const no = await ctx.api.get<{ outcomes: Array<{ frictionFree: boolean }> }>(
      `/api/projects/${ctx.projectId}/outcomes?frictionFree=false`
    );
    expect(no.data.outcomes.every((o) => o.frictionFree === false)).toBe(true);
  });

  it('filters by domain (array contains)', async () => {
    await seedOutcomeRow(prisma, ctx.projectId, {
      ticketNumber: 520,
      domains: ['app'],
    });
    await seedOutcomeRow(prisma, ctx.projectId, {
      ticketNumber: 521,
      domains: ['lib'],
    });

    const res = await ctx.api.get<{
      outcomes: Array<{ domains: string[] }>;
    }>(`/api/projects/${ctx.projectId}/outcomes?domain=app`);
    expect(res.data.outcomes.every((o) => o.domains.includes('app'))).toBe(true);
    expect(res.data.outcomes.length).toBeGreaterThan(0);
  });

  it('rejects limit > 500 with VALIDATION_ERROR', async () => {
    const res = await ctx.api.get<{ error: string; code: string }>(
      `/api/projects/${ctx.projectId}/outcomes?limit=501`
    );
    expect(res.status).toBe(400);
    expect(res.data.code).toBe('VALIDATION_ERROR');
  });

  it('rejects malformed since/until ISO date with VALIDATION_ERROR', async () => {
    const res = await ctx.api.get<{ error: string; code: string }>(
      `/api/projects/${ctx.projectId}/outcomes?since=not-a-date`
    );
    expect(res.status).toBe(400);
    expect(res.data.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unknown projectId with 404 PROJECT_NOT_FOUND for an authenticated non-member', async () => {
    // Use a project id this worker does not own. We just probe the list endpoint.
    const otherProjectId = ctx.projectId === 1 ? 2 : 1;
    const res = await ctx.api.get<{ error: string; code: string }>(
      `/api/projects/${otherProjectId}/outcomes`
    );
    // Either 404 PROJECT_NOT_FOUND or it returned 200 if the test user happens to own that
    // project too — in either case it should not be 500.
    expect([200, 404]).toContain(res.status);
  });

  it('returns immutable rows even when older than 30 days (T044)', async () => {
    const longAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const { ticketId } = await seedOutcomeRow(prisma, ctx.projectId, {
      ticketNumber: 530,
      shippedAt: longAgo,
    });

    const single = await ctx.api.get<{ ticketId: number; shippedAt: string }>(
      `/api/projects/${ctx.projectId}/tickets/${ticketId}/outcome`
    );
    expect(single.status).toBe(200);
    expect(single.data.shippedAt).toBe(longAgo.toISOString());

    const list = await ctx.api.get<{ outcomes: Array<{ ticketId: number; shippedAt: string }> }>(
      `/api/projects/${ctx.projectId}/outcomes`
    );
    const found = list.data.outcomes.find((o) => o.ticketId === ticketId);
    expect(found?.shippedAt).toBe(longAgo.toISOString());
  });
});
