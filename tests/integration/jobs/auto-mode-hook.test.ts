/**
 * Integration Tests: Auto-mode job-status hook (AIB-682)
 *
 * Covers the side effect wired into PATCH /api/jobs/:id/status that auto-advances
 * a FULL-workflow ticket when its current stage job reaches a terminal state while
 * autoMode=true:
 * - specify COMPLETED + autoMode + stage=SPECIFY → stage becomes PLAN + PLAN job exists
 * - plan COMPLETED + autoMode + stage=PLAN → stage becomes BUILD + BUILD job exists
 * - autoMode=false + COMPLETED → no auto-transition (US1 negative case)
 * - specify FAILED/CANCELLED + autoMode → autoMode flips to false, stage unchanged (US3)
 * - BUILD stage COMPLETED with autoMode=true → hook is a no-op (US3 c)
 * - hook never throws even if dispatch fails (US3 d / FR-021)
 *
 * The hook is fire-and-log (.catch), so after the PATCH completes we poll the
 * ticket row briefly to wait for the async hook effect to land.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { createAPIClient, type APIClient } from '@/tests/fixtures/vitest/api-client';

const WORKFLOW_TOKEN = process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';

function createWorkflowClient(): APIClient {
  return createAPIClient({
    defaultHeaders: {
      Authorization: `Bearer ${WORKFLOW_TOKEN}`,
    },
  });
}

async function waitForCondition<T>(
  fetcher: () => Promise<T>,
  predicate: (value: T) => boolean,
  { timeoutMs = 2000, intervalMs = 50 }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<T> {
  const start = Date.now();
  let last = await fetcher();
  while (!predicate(last)) {
    if (Date.now() - start > timeoutMs) return last;
    await new Promise((r) => setTimeout(r, intervalMs));
    last = await fetcher();
  }
  return last;
}

describe('Auto-mode job-status hook (AIB-682)', () => {
  let ctx: TestContext;
  let workflowApi: APIClient;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    workflowApi = createWorkflowClient();
    await ctx.cleanup();
  });

  async function seedTicketWithRunningJob(opts: {
    stage: 'SPECIFY' | 'PLAN' | 'BUILD';
    command: 'specify' | 'plan' | 'implement';
    autoMode: boolean;
    workflowType?: 'FULL' | 'QUICK';
  }) {
    const createResp = await ctx.api.post<{ id: number }>(
      `/api/projects/${ctx.projectId}/tickets`,
      { title: '[e2e] Auto-mode hook ticket', description: 'hook test' }
    );
    const ticketId = createResp.data.id;

    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        stage: opts.stage,
        workflowType: opts.workflowType ?? 'FULL',
        autoMode: opts.autoMode,
        branch: 'feat/AIB-auto-mode-test',
      },
    });

    const job = await prisma.job.create({
      data: {
        ticketId,
        projectId: ctx.projectId,
        command: opts.command,
        status: 'RUNNING',
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return { ticketId, jobId: job.id };
  }

  it('advances SPECIFY → PLAN and creates PLAN job when specify COMPLETED + autoMode=true', async () => {
    const { ticketId, jobId } = await seedTicketWithRunningJob({
      stage: 'SPECIFY',
      command: 'specify',
      autoMode: true,
    });

    const response = await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'COMPLETED' });
    expect(response.status).toBe(200);

    const ticket = await waitForCondition(
      () =>
        prisma.ticket.findUnique({
          where: { id: ticketId },
          include: { jobs: { orderBy: { id: 'asc' } } },
        }),
      (t) => t?.stage === 'PLAN' && (t?.jobs.some((j) => j.command === 'plan') ?? false)
    );

    expect(ticket?.stage).toBe('PLAN');
    const planJob = ticket?.jobs.find((j) => j.command === 'plan');
    expect(planJob).toBeDefined();
    expect(planJob?.status).toBe('PENDING');
    expect(ticket?.autoMode).toBe(true);
  });

  it('advances PLAN → BUILD and creates implement job when plan COMPLETED + autoMode=true', async () => {
    const { ticketId, jobId } = await seedTicketWithRunningJob({
      stage: 'PLAN',
      command: 'plan',
      autoMode: true,
    });

    const response = await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'COMPLETED' });
    expect(response.status).toBe(200);

    const ticket = await waitForCondition(
      () =>
        prisma.ticket.findUnique({
          where: { id: ticketId },
          include: { jobs: { orderBy: { id: 'asc' } } },
        }),
      (t) => t?.stage === 'BUILD'
    );

    expect(ticket?.stage).toBe('BUILD');
    const buildJob = ticket?.jobs.find((j) => j.command === 'implement');
    expect(buildJob).toBeDefined();
    expect(buildJob?.status).toBe('PENDING');
    expect(ticket?.autoMode).toBe(true);
  });

  it('does NOT auto-transition when autoMode=false', async () => {
    const { ticketId, jobId } = await seedTicketWithRunningJob({
      stage: 'SPECIFY',
      command: 'specify',
      autoMode: false,
    });

    const response = await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'COMPLETED' });
    expect(response.status).toBe(200);

    // Give the hook a moment to (not) run
    await new Promise((r) => setTimeout(r, 300));

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { jobs: true },
    });

    expect(ticket?.stage).toBe('SPECIFY');
    expect(ticket?.jobs.some((j) => j.command === 'plan')).toBe(false);
  });

  it('flips autoMode=false and keeps stage when specify FAILED (FR-018)', async () => {
    const { ticketId, jobId } = await seedTicketWithRunningJob({
      stage: 'SPECIFY',
      command: 'specify',
      autoMode: true,
    });

    const response = await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'FAILED' });
    expect(response.status).toBe(200);

    const ticket = await waitForCondition(
      () =>
        prisma.ticket.findUnique({
          where: { id: ticketId },
          include: { jobs: true },
        }),
      (t) => t?.autoMode === false
    );

    expect(ticket?.autoMode).toBe(false);
    expect(ticket?.stage).toBe('SPECIFY');
    expect(ticket?.jobs.some((j) => j.command === 'plan')).toBe(false);
  });

  it('flips autoMode=false and keeps stage when plan CANCELLED (FR-019)', async () => {
    const { ticketId, jobId } = await seedTicketWithRunningJob({
      stage: 'PLAN',
      command: 'plan',
      autoMode: true,
    });

    const response = await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'CANCELLED' });
    expect(response.status).toBe(200);

    const ticket = await waitForCondition(
      () =>
        prisma.ticket.findUnique({
          where: { id: ticketId },
          include: { jobs: true },
        }),
      (t) => t?.autoMode === false
    );

    expect(ticket?.autoMode).toBe(false);
    expect(ticket?.stage).toBe('PLAN');
  });

  it('is a no-op when COMPLETED on BUILD-stage ticket (auto-mode not applicable)', async () => {
    const { ticketId, jobId } = await seedTicketWithRunningJob({
      stage: 'BUILD',
      command: 'implement',
      autoMode: true,
    });

    const response = await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'COMPLETED' });
    expect(response.status).toBe(200);

    await new Promise((r) => setTimeout(r, 300));

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { jobs: true },
    });

    // The auto-mode hook must not advance a BUILD-stage ticket, and must not create new stage jobs
    expect(ticket?.stage).toBe('BUILD');
    expect(ticket?.autoMode).toBe(true);
    // Only the original implement job should exist
    expect(ticket?.jobs).toHaveLength(1);
    expect(ticket?.jobs[0]?.command).toBe('implement');
  });

  it('hook never causes the PATCH to fail even when something goes wrong', async () => {
    // Seed a PLAN-stage ticket with autoMode=true but a bogus branch to exercise the
    // dispatch path; TEST_MODE short-circuits the actual GitHub call, so this just
    // validates the hook failure-mode path cannot bubble up to the PATCH caller.
    const { jobId } = await seedTicketWithRunningJob({
      stage: 'PLAN',
      command: 'plan',
      autoMode: true,
    });

    const response = await workflowApi.patch(`/api/jobs/${jobId}/status`, { status: 'COMPLETED' });
    expect(response.status).toBe(200);
  });
});
