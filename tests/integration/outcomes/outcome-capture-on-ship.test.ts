/**
 * Integration tests for live SHIP outcome capture (User Story 1).
 *
 * Drives `captureOutcomeOnShip` directly against a seeded ticket + jobs in the worker's
 * isolated test project. Octokit calls are short-circuited via TEST_MODE=true; tests
 * shape the mocked file payload with TEST_OUTCOME_FILES.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { JobStatus, Stage, WorkflowType, type Prisma } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { captureOutcomeOnShip } from '@/lib/outcomes/capture';

beforeAll(() => {
  process.env.TEST_MODE = 'true';
});

afterEach(() => {
  delete process.env.TEST_OUTCOME_FILES;
});

interface SeedJob {
  command: string;
  status?: JobStatus;
  costUsd?: number | null;
  durationMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  qualityScore?: number | null;
  toolsUsed?: string[];
  completedAt?: Date | null;
}

async function seedTicketWithJobs(
  prisma: ReturnType<typeof getPrismaClient>,
  projectId: number,
  opts: {
    ticketNumber: number;
    workflowType?: WorkflowType;
    stage?: Stage;
    branch?: string | null;
    jobs: SeedJob[];
    projectConfig?: Prisma.InputJsonValue;
  }
): Promise<{ ticketId: number; ticketKey: string }> {
  const ticket = await prisma.ticket.create({
    data: {
      projectId,
      title: `[e2e] outcome capture ${opts.ticketNumber}`,
      description: 'outcome integration test',
      stage: opts.stage ?? Stage.SHIP,
      workflowType: opts.workflowType ?? WorkflowType.FULL,
      ticketNumber: opts.ticketNumber,
      ticketKey: `E2E-O${opts.ticketNumber}-${Date.now().toString().slice(-6)}`,
      branch:
        opts.branch === undefined
          ? `${opts.ticketNumber}-feature-branch`
          : opts.branch,
      updatedAt: new Date(),
    },
  });

  if (opts.projectConfig) {
    await prisma.project.update({
      where: { id: projectId },
      data: { config: opts.projectConfig, configSyncedAt: new Date() },
    });
  }

  for (const job of opts.jobs) {
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId,
        command: job.command,
        status: job.status ?? JobStatus.COMPLETED,
        costUsd: job.costUsd ?? 0.1,
        durationMs: job.durationMs ?? 1000,
        inputTokens: job.inputTokens ?? 100,
        outputTokens: job.outputTokens ?? 50,
        qualityScore: job.qualityScore ?? null,
        toolsUsed: job.toolsUsed ?? ['Edit'],
        completedAt:
          job.completedAt ??
          (job.status === JobStatus.COMPLETED || !job.status ? new Date() : null),
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  return { ticketId: ticket.id, ticketKey: ticket.ticketKey };
}

describe('Outcome capture on SHIP', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    // Reset project config so each test starts from a known stack baseline.
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: {
        config: {
          version: 1,
          project: { name: 'test', language: 'typescript', framework: 'nextjs' },
          services: [{ type: 'postgres' }],
          testing: { framework: 'vitest' },
        },
        configSyncedAt: new Date(),
      },
    });
  });

  it('happy path — FULL ticket with verify quality 90 and four pipeline jobs (T013, US1 #1)', async () => {
    process.env.TEST_OUTCOME_FILES = JSON.stringify([
      { filename: 'app/api/foo.ts', additions: 50, deletions: 10 },
      { filename: 'lib/billing/charge.ts', additions: 30, deletions: 5 },
      { filename: 'tests/integration/foo.test.ts', additions: 30, deletions: 10 },
    ]);

    const { ticketId } = await seedTicketWithJobs(prisma, ctx.projectId, {
      ticketNumber: 100,
      workflowType: WorkflowType.FULL,
      jobs: [
        { command: 'specify' },
        { command: 'plan' },
        { command: 'implement' },
        { command: 'verify', qualityScore: 90 },
      ],
    });

    const result = await captureOutcomeOnShip({
      ticketId,
      projectId: ctx.projectId,
      workflowType: WorkflowType.FULL,
      shippedAt: new Date(),
    });

    expect(result.status).toBe('created');
    expect(result.partial).toBe(false);

    const row = await prisma.ticketOutcome.findUnique({ where: { ticketId } });
    expect(row).not.toBeNull();
    expect(row!.partial).toBe(false);
    expect(row!.frictionFree).toBe(true);
    expect(row!.qualityScore).toBe(90);
    expect(row!.workflowType).toBe(WorkflowType.FULL);
    expect(row!.totalJobCount).toBe(4);
    expect(row!.pipelineJobCount).toBe(4);
    expect(row!.frictionJobCount).toBe(0);
    expect(row!.ruleSetVersion).toBe(1);
    expect(row!.touchedTests).toBe(true);
    expect(row!.linesAdded).toBe(110);
    expect(row!.linesRemoved).toBe(25);
  });

  it('friction classification — iterate + comment-build jobs prevent frictionFree (T014, US1 #2)', async () => {
    process.env.TEST_OUTCOME_FILES = JSON.stringify([
      { filename: 'app/foo.ts', additions: 5, deletions: 1 },
    ]);

    const { ticketId } = await seedTicketWithJobs(prisma, ctx.projectId, {
      ticketNumber: 101,
      workflowType: WorkflowType.FULL,
      jobs: [
        { command: 'verify', qualityScore: 95 },
        { command: 'iterate' },
        { command: 'iterate' },
        { command: 'comment-build' },
      ],
    });

    await captureOutcomeOnShip({
      ticketId,
      projectId: ctx.projectId,
      workflowType: WorkflowType.FULL,
      shippedAt: new Date(),
    });

    const row = await prisma.ticketOutcome.findUnique({ where: { ticketId } });
    expect(row!.frictionJobCount).toBeGreaterThanOrEqual(3);
    expect(row!.frictionFree).toBe(false);
  });

  it('QUICK workflow — no quality score, frictionFree=false (T015, US1 #3)', async () => {
    process.env.TEST_OUTCOME_FILES = JSON.stringify([
      { filename: 'app/foo.ts', additions: 1, deletions: 0 },
    ]);

    const { ticketId } = await seedTicketWithJobs(prisma, ctx.projectId, {
      ticketNumber: 102,
      workflowType: WorkflowType.QUICK,
      jobs: [{ command: 'quick-impl' }],
    });

    await captureOutcomeOnShip({
      ticketId,
      projectId: ctx.projectId,
      workflowType: WorkflowType.QUICK,
      shippedAt: new Date(),
    });

    const row = await prisma.ticketOutcome.findUnique({ where: { ticketId } });
    expect(row!.workflowType).toBe(WorkflowType.QUICK);
    expect(row!.qualityScore).toBeNull();
    expect(row!.frictionFree).toBe(false);
  });

  it('multi-stack: Python+postgres+pytest (T026, US2 #1)', async () => {
    process.env.TEST_OUTCOME_FILES = JSON.stringify([
      { filename: 'migrations/0042_add_field.py', additions: 10, deletions: 0 },
      { filename: 'tests/test_users.py', additions: 20, deletions: 5 },
      { filename: '.github/workflows/ci.yml', additions: 5, deletions: 1 },
    ]);

    const { ticketId } = await seedTicketWithJobs(prisma, ctx.projectId, {
      ticketNumber: 110,
      workflowType: WorkflowType.FULL,
      projectConfig: {
        version: 1,
        project: { name: 'py-test', language: 'python' },
        services: [{ type: 'postgres' }],
        testing: { framework: 'pytest' },
      },
      jobs: [{ command: 'verify', qualityScore: 80 }],
    });

    await captureOutcomeOnShip({
      ticketId,
      projectId: ctx.projectId,
      workflowType: WorkflowType.FULL,
      shippedAt: new Date(),
    });

    const row = await prisma.ticketOutcome.findUnique({ where: { ticketId } });
    expect(row!.touchedDbSchema).toBe(true);
    expect(row!.touchedTests).toBe(true);
    expect(row!.touchedCi).toBe(true);
  });

  it('multi-stack: Rust touching only src/lib.rs (T026, US2 #2)', async () => {
    process.env.TEST_OUTCOME_FILES = JSON.stringify([
      { filename: 'src/lib.rs', additions: 50, deletions: 10 },
    ]);

    const { ticketId } = await seedTicketWithJobs(prisma, ctx.projectId, {
      ticketNumber: 111,
      workflowType: WorkflowType.FULL,
      projectConfig: {
        version: 1,
        project: { name: 'rs-test', language: 'rust' },
        services: [],
        testing: { framework: 'rust-test' },
      },
      jobs: [{ command: 'verify', qualityScore: 85 }],
    });

    await captureOutcomeOnShip({
      ticketId,
      projectId: ctx.projectId,
      workflowType: WorkflowType.FULL,
      shippedAt: new Date(),
    });

    const row = await prisma.ticketOutcome.findUnique({ where: { ticketId } });
    expect(row!.touchedDbSchema).toBe(false);
    expect(row!.touchedTests).toBe(false);
    expect(row!.touchedCi).toBe(false);
    expect(row!.domains).toContain('src');
  });

  it('multi-stack: TS app+lib domains tracked (T026, US2 #3)', async () => {
    process.env.TEST_OUTCOME_FILES = JSON.stringify([
      { filename: 'app/api/foo.ts', additions: 20, deletions: 0 },
      { filename: 'lib/billing/charge.ts', additions: 15, deletions: 2 },
      { filename: 'lib/utils/helper.ts', additions: 5, deletions: 1 },
    ]);

    const { ticketId } = await seedTicketWithJobs(prisma, ctx.projectId, {
      ticketNumber: 112,
      workflowType: WorkflowType.FULL,
      jobs: [{ command: 'verify', qualityScore: 85 }],
    });

    await captureOutcomeOnShip({
      ticketId,
      projectId: ctx.projectId,
      workflowType: WorkflowType.FULL,
      shippedAt: new Date(),
    });

    const row = await prisma.ticketOutcome.findUnique({ where: { ticketId } });
    expect(row!.domains.sort()).toEqual(['app', 'lib']);
    expect((row!.domainFileCounts as Record<string, number>).lib).toBe(2);
    expect((row!.domainFileCounts as Record<string, number>).app).toBe(1);
  });

  it('missing project stack declarations: capture succeeds with all-false semantic tags (T027, US2 #4)', async () => {
    process.env.TEST_OUTCOME_FILES = JSON.stringify([
      { filename: 'somewhere/foo', additions: 1, deletions: 0 },
    ]);

    await prisma.project.update({
      where: { id: ctx.projectId },
      data: { config: {}, configSyncedAt: new Date() },
    });

    const { ticketId } = await seedTicketWithJobs(prisma, ctx.projectId, {
      ticketNumber: 113,
      jobs: [{ command: 'verify', qualityScore: 80 }],
    });

    await captureOutcomeOnShip({
      ticketId,
      projectId: ctx.projectId,
      workflowType: WorkflowType.FULL,
      shippedAt: new Date(),
    });

    const row = await prisma.ticketOutcome.findUnique({ where: { ticketId } });
    expect(row).not.toBeNull();
    expect(row!.touchedDbSchema).toBe(false);
    expect(row!.touchedTests).toBe(false);
    // The CI patterns are generic (always evaluated); if a file matches them they tag.
    // Our test file does NOT match CI patterns so this should also be false.
    expect(row!.touchedCi).toBe(false);
  });
});
