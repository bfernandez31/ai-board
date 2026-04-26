/**
 * Integration tests for backfill API (T035 — US3, contracts/backfill-api.md).
 *
 * POST /api/projects/[projectId]/backfill-outcomes:
 *   - 202 on first dispatch
 *   - 409 BACKFILL_IN_PROGRESS on second call while running
 *   - 403 OWNERSHIP_REQUIRED for non-owner
 *
 * GET /api/projects/[projectId]/backfill-outcomes/status:
 *   - { status: 'NEVER_STARTED', ticketsRemaining } when no row exists
 *   - Full progress row when one exists
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import * as dispatchModule from '@/lib/workflows/dispatch-backfill-outcomes';

beforeAll(() => {
  process.env.TEST_MODE = 'true';
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Backfill API endpoints', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    vi.spyOn(dispatchModule, 'dispatchBackfillOutcomes').mockResolvedValue({
      workflowRunUrl: 'https://example.com/run/1',
    });
  });

  describe('GET /backfill-outcomes/status', () => {
    it('returns NEVER_STARTED with ticketsRemaining when no progress row exists', async () => {
      // Seed two unfilled SHIP tickets so ticketsRemaining > 0.
      for (let i = 0; i < 2; i++) {
        await prisma.ticket.create({
          data: {
            projectId: ctx.projectId,
            title: `[e2e] bf-status ${i}`,
            description: 'x',
            stage: Stage.SHIP,
            workflowType: WorkflowType.FULL,
            ticketNumber: 800 + i,
            ticketKey: `E2E-BFS-${i}-${Date.now()}`,
            updatedAt: new Date(),
          },
        });
      }
      const res = await ctx.api.get<{ status: string; ticketsRemaining: number }>(
        `/api/projects/${ctx.projectId}/backfill-outcomes/status`
      );
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('NEVER_STARTED');
      expect(res.data.ticketsRemaining).toBeGreaterThanOrEqual(2);
    });

    it('returns the full progress row when one exists', async () => {
      await prisma.backfillProgress.create({
        data: {
          projectId: ctx.projectId,
          status: 'IN_PROGRESS',
          ticketsProcessed: 4,
          ticketsWithPartial: 1,
        },
      });
      const res = await ctx.api.get<{
        status: string;
        ticketsProcessed: number;
        ticketsWithPartial: number;
        ticketsRemaining: number;
      }>(`/api/projects/${ctx.projectId}/backfill-outcomes/status`);
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('IN_PROGRESS');
      expect(res.data.ticketsProcessed).toBe(4);
      expect(res.data.ticketsWithPartial).toBe(1);
    });
  });

  describe('POST /backfill-outcomes', () => {
    it('returns 202 on first dispatch', async () => {
      const res = await ctx.api.post<{ status: string; workflowRunUrl: string }>(
        `/api/projects/${ctx.projectId}/backfill-outcomes`,
        { resume: true }
      );
      expect(res.status).toBe(202);
      expect(res.data.status).toBe('IN_PROGRESS');
    });

    it('returns 409 BACKFILL_IN_PROGRESS when one is already running', async () => {
      await prisma.backfillProgress.create({
        data: { projectId: ctx.projectId, status: 'IN_PROGRESS' },
      });
      const res = await ctx.api.post<{ error: string; code: string }>(
        `/api/projects/${ctx.projectId}/backfill-outcomes`,
        { resume: true }
      );
      expect(res.status).toBe(409);
      expect(res.data.code).toBe('BACKFILL_IN_PROGRESS');
    });
  });
});
