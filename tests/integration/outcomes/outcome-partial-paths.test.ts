/**
 * Integration tests for partial-state paths (T017, US1 #4; spec edge cases).
 *
 * Sub-cases (branch-centric model after AIB-748):
 *   (a) ticket with zero jobs                       → partialReason='no_jobs'
 *   (b) ticket with no branch reference             → partialReason='no_branch_reference'
 *   (c) Octokit failure after retries               → partialReason='fetch_failed_after_retry'
 *   (d) repo unreachable                            → partialReason='repository_unreachable'
 *   (e) no merged PR found and branch ref missing   → partialReason='merge_not_found'
 *
 * In all five the change-shape fields are null/empty and job aggregates remain populated
 * (where possible).
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { captureOutcomeOnShip } from '@/lib/outcomes/capture';
import * as githubFiles from '@/lib/outcomes/github-files';

beforeAll(() => {
  process.env.TEST_MODE = 'true';
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Outcome partial-state paths (US1 #4)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: {
        config: {
          version: 1,
          project: { name: 't', language: 'typescript' },
          services: [{ type: 'postgres' }],
          testing: { framework: 'vitest' },
        },
        configSyncedAt: new Date(),
      },
    });
  });

  async function seedTicket(opts: {
    ticketNumber: number;
    workflowType?: WorkflowType;
    branch?: string | null;
  }): Promise<number> {
    const t = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: `[e2e] partial ${opts.ticketNumber}`,
        description: 'x',
        stage: Stage.SHIP,
        workflowType: opts.workflowType ?? WorkflowType.FULL,
        ticketNumber: opts.ticketNumber,
        ticketKey: `E2E-P${opts.ticketNumber}-${Date.now().toString().slice(-6)}`,
        branch: opts.branch === undefined ? `branch-${opts.ticketNumber}` : opts.branch,
        updatedAt: new Date(),
      },
    });
    return t.id;
  }

  it('(a) ticket with zero jobs → partialReason=no_jobs', async () => {
    const ticketId = await seedTicket({ ticketNumber: 300 });

    await captureOutcomeOnShip({
      ticketId,
      projectId: ctx.projectId,
      workflowType: WorkflowType.FULL,
      shippedAt: new Date(),
    });

    const row = await prisma.ticketOutcome.findUnique({ where: { ticketId } });
    expect(row!.partial).toBe(true);
    expect(row!.partialReason).toBe('no_jobs');
    expect(row!.linesAdded).toBeNull();
    expect(row!.linesRemoved).toBeNull();
    expect(row!.filesTouched).toEqual([]);
    expect(row!.touchedDbSchema).toBe(false);
    expect(row!.touchedTests).toBe(false);
    expect(row!.touchedCi).toBe(false);
    expect(row!.totalJobCount).toBe(0);
  });

  it('(b) ticket with no branch reference → partialReason=no_branch_reference; aggregates still populated', async () => {
    const ticketId = await seedTicket({ ticketNumber: 301, branch: null });

    await prisma.job.create({
      data: {
        ticketId,
        projectId: ctx.projectId,
        command: 'verify',
        status: JobStatus.COMPLETED,
        costUsd: 0.5,
        durationMs: 2000,
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await captureOutcomeOnShip({
      ticketId,
      projectId: ctx.projectId,
      workflowType: WorkflowType.FULL,
      shippedAt: new Date(),
    });

    const row = await prisma.ticketOutcome.findUnique({ where: { ticketId } });
    expect(row!.partial).toBe(true);
    expect(row!.partialReason).toBe('no_branch_reference');
    // Job aggregates still populated
    expect(row!.totalJobCount).toBe(1);
    expect(row!.totalCostUsd).toBe(0.5);
    expect(row!.totalDurationMs).toBe(2000);
    // Change-shape fields null/empty
    expect(row!.linesAdded).toBeNull();
    expect(row!.filesTouched).toEqual([]);
  });

  it('(c) Octokit failure after retries → partialReason=fetch_failed_after_retry', async () => {
    const ticketId = await seedTicket({ ticketNumber: 302 });

    await prisma.job.create({
      data: {
        ticketId,
        projectId: ctx.projectId,
        command: 'verify',
        status: JobStatus.COMPLETED,
        qualityScore: 80,
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    vi.spyOn(githubFiles, 'fetchBranchDiff').mockResolvedValueOnce({
      files: [],
      mergeCommitSha: null,
      failure: 'fetch_failed_after_retry',
    });

    await captureOutcomeOnShip({
      ticketId,
      projectId: ctx.projectId,
      workflowType: WorkflowType.FULL,
      shippedAt: new Date(),
    });

    const row = await prisma.ticketOutcome.findUnique({ where: { ticketId } });
    expect(row!.partial).toBe(true);
    expect(row!.partialReason).toBe('fetch_failed_after_retry');
    expect(row!.totalJobCount).toBe(1);
    expect(row!.linesAdded).toBeNull();
    expect(row!.filesTouched).toEqual([]);
  });

  it('(d) repo unreachable → partialReason=repository_unreachable', async () => {
    const ticketId = await seedTicket({ ticketNumber: 303 });

    await prisma.job.create({
      data: {
        ticketId,
        projectId: ctx.projectId,
        command: 'verify',
        status: JobStatus.COMPLETED,
        qualityScore: 80,
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    vi.spyOn(githubFiles, 'fetchBranchDiff').mockResolvedValueOnce({
      files: [],
      mergeCommitSha: null,
      failure: 'repository_unreachable',
    });

    await captureOutcomeOnShip({
      ticketId,
      projectId: ctx.projectId,
      workflowType: WorkflowType.FULL,
      shippedAt: new Date(),
    });

    const row = await prisma.ticketOutcome.findUnique({ where: { ticketId } });
    expect(row!.partial).toBe(true);
    expect(row!.partialReason).toBe('repository_unreachable');
  });

  it('(e) no merged PR + branch ref missing → partialReason=merge_not_found', async () => {
    const ticketId = await seedTicket({ ticketNumber: 304 });

    await prisma.job.create({
      data: {
        ticketId,
        projectId: ctx.projectId,
        command: 'verify',
        status: JobStatus.COMPLETED,
        qualityScore: 80,
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    vi.spyOn(githubFiles, 'fetchBranchDiff').mockResolvedValueOnce({
      files: [],
      mergeCommitSha: null,
      failure: 'merge_not_found',
    });

    await captureOutcomeOnShip({
      ticketId,
      projectId: ctx.projectId,
      workflowType: WorkflowType.FULL,
      shippedAt: new Date(),
    });

    const row = await prisma.ticketOutcome.findUnique({ where: { ticketId } });
    expect(row!.partial).toBe(true);
    expect(row!.partialReason).toBe('merge_not_found');
    expect(row!.linesAdded).toBeNull();
    expect(row!.filesTouched).toEqual([]);
  });
});
