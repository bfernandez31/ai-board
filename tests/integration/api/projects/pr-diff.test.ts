/**
 * Integration Tests: GET /api/projects/:projectId/tickets/:id/pr-diff (AIB-879)
 *
 * Exercises the PR diff route in test mode (deterministic GitHub fixture driven
 * by the ticket branch) against a real DB-loaded verify job. Covers US1 (layers +
 * files), US2 (inline comments + attribution + outdated), and US3 (no-PR,
 * never-reviewed, additional-changes, auth-required, forbidden).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import type { PrDiffResponse } from '@/app/lib/schemas/pr-diff';

const prisma = getPrismaClient();

const REVIEWED_ARTIFACT = JSON.stringify({
  version: 1,
  computedAt: '2026-06-30T10:00:00Z',
  layers: [
    {
      id: 'foundations',
      title: 'Foundations',
      summary: 'schema & contracts',
      order: 1,
      files: ['prisma/schema.prisma', 'lib/pr-layers.ts'],
    },
    {
      id: 'ui',
      title: 'UI',
      summary: 'viewer',
      order: 2,
      files: ['components/ticket/pr-diff-viewer.tsx'],
    },
  ],
});

async function createTicketWithBranch(ctx: TestContext, branch: string): Promise<number> {
  const create = await ctx.api.post<{ id: number }>(
    `/api/projects/${ctx.projectId}/tickets`,
    { title: '[e2e] PR Diff Ticket', description: 'pr diff test' }
  );
  const ticketId = create.data.id;
  await prisma.ticket.update({ where: { id: ticketId }, data: { branch } });
  return ticketId;
}

async function createCompletedVerifyJob(
  ctx: TestContext,
  ticketId: number,
  opts: { qualityScore?: number; layerDecomposition?: string } = {}
): Promise<void> {
  await prisma.job.create({
    data: {
      ticketId,
      projectId: ctx.projectId,
      command: 'verify',
      status: 'COMPLETED',
      startedAt: new Date(),
      updatedAt: new Date(),
      qualityScore: opts.qualityScore ?? null,
      layerDecomposition: opts.layerDecomposition ?? null,
    },
  });
}

describe('GET /api/projects/:projectId/tickets/:id/pr-diff', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  describe('US1: reviewed PR with layers + files', () => {
    it('returns ordered layers (synthetic last) with files and a flat file list', async () => {
      const ticketId = await createTicketWithBranch(ctx, 'AIB-879-reviewed');
      await createCompletedVerifyJob(ctx, ticketId, {
        qualityScore: 84,
        layerDecomposition: REVIEWED_ARTIFACT,
      });

      const res = await ctx.api.get<PrDiffResponse>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/pr-diff`
      );

      expect(res.status).toBe(200);
      expect(res.data.pr).not.toBeNull();
      expect(res.data.pr!.number).toBe(542);

      expect(res.data.layers.map((l) => l.id)).toEqual([
        'foundations',
        'ui',
        'additional-changes',
      ]);

      const foundations = res.data.layers[0]!;
      expect(foundations.files.map((f) => f.filename).sort()).toEqual([
        'lib/pr-layers.ts',
        'prisma/schema.prisma',
      ]);
      expect(foundations.fileCount).toBe(2);

      // Flat list contains every changed file.
      expect(res.data.files.length).toBe(5);

      // Overview carries the persisted score + derived threshold.
      expect(res.data.overview.qualityScore).toBe(84);
      expect(res.data.overview.qualityThreshold).toBe('Good');
    });
  });

  describe('US2: inline comments with attribution + outdated handling', () => {
    it('maps comments from ai-board, a third-party bot, and a human, with one outdated', async () => {
      const ticketId = await createTicketWithBranch(ctx, 'AIB-879-comments');
      await createCompletedVerifyJob(ctx, ticketId, {
        qualityScore: 84,
        layerDecomposition: REVIEWED_ARTIFACT,
      });

      const res = await ctx.api.get<PrDiffResponse>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/pr-diff`
      );

      expect(res.status).toBe(200);

      const schemaFile = res.data.files.find((f) => f.filename === 'prisma/schema.prisma')!;
      const aiComment = schemaFile.comments.find((c) => c.id === 1)!;
      expect(aiComment.source).toBe('ai-board');
      expect(aiComment.author).toBe('ai-board[bot]');
      expect(aiComment.line).toBe(4);
      expect(aiComment.outdated).toBe(false);

      const outdated = schemaFile.comments.find((c) => c.id === 4)!;
      expect(outdated.outdated).toBe(true);
      expect(outdated.line).toBeNull();

      const libFile = res.data.files.find((f) => f.filename === 'lib/pr-layers.ts')!;
      expect(libFile.comments[0]!.source).toBe('bot');
      expect(libFile.comments[0]!.author).toBe('dependabot[bot]');

      const uiFile = res.data.files.find(
        (f) => f.filename === 'components/ticket/pr-diff-viewer.tsx'
      )!;
      expect(uiFile.comments[0]!.source).toBe('human');
      expect(uiFile.comments[0]!.author).toBe('alice');
    });
  });

  describe('US3: fallbacks and additional-changes', () => {
    it('returns a 200 empty state when no PR exists', async () => {
      const ticketId = await createTicketWithBranch(ctx, 'AIB-879-no-pr');

      const res = await ctx.api.get<PrDiffResponse>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/pr-diff`
      );

      expect(res.status).toBe(200);
      expect(res.data.pr).toBeNull();
      expect(res.data.layers).toEqual([]);
      expect(res.data.files).toEqual([]);
    });

    it('returns layers:[] for a never-reviewed PR (no verify job)', async () => {
      const ticketId = await createTicketWithBranch(ctx, 'AIB-879-never-reviewed');

      const res = await ctx.api.get<PrDiffResponse>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/pr-diff`
      );

      expect(res.status).toBe(200);
      expect(res.data.pr).not.toBeNull();
      expect(res.data.layers).toEqual([]);
      expect(res.data.files.length).toBeGreaterThan(0);
    });

    it('routes a post-review file into the synthetic "additional-changes" layer', async () => {
      const ticketId = await createTicketWithBranch(ctx, 'AIB-879-additional');
      await createCompletedVerifyJob(ctx, ticketId, {
        qualityScore: 84,
        layerDecomposition: REVIEWED_ARTIFACT,
      });

      const res = await ctx.api.get<PrDiffResponse>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/pr-diff`
      );

      expect(res.status).toBe(200);
      const synthetic = res.data.layers.find((l) => l.id === 'additional-changes')!;
      expect(synthetic.synthetic).toBe(true);
      expect(synthetic.files.map((f) => f.filename)).toContain('app/api/new-route.ts');
    });

    it('returns AUTH_REQUIRED (403) when GitHub authorization is missing', async () => {
      const ticketId = await createTicketWithBranch(ctx, 'AIB-879-auth-required');

      const res = await ctx.api.get<{ code: string }>(
        `/api/projects/${ctx.projectId}/tickets/${ticketId}/pr-diff`
      );

      expect(res.status).toBe(403);
      expect(res.data.code).toBe('AUTH_REQUIRED');
    });

    it('returns FORBIDDEN (403) for a project the user cannot access', async () => {
      const res = await ctx.api.get<{ code: string }>(
        `/api/projects/999999/tickets/1/pr-diff`
      );

      expect(res.status).toBe(403);
      expect(res.data.code).toBe('FORBIDDEN');
    });
  });
});
