/**
 * Unit Tests: Auto-transition helper (AIB-683)
 *
 * Validates the server-side side-effects run after a workflow job reaches a
 * terminal state for tickets with autoMode on.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  prisma: {
    job: { findUnique: vi.fn() },
    ticket: { updateMany: vi.fn() },
  },
}));

vi.mock('@/lib/tickets/transition', () => ({
  executeTicketTransition: vi.fn(),
}));

import { prisma } from '@/lib/db/client';
import { executeTicketTransition } from '@/lib/tickets/transition';
import { handleAutoTransitionAfterJob } from '@/lib/tickets/auto-transition';

const mockedFindJob = vi.mocked(prisma.job.findUnique);
const mockedUpdateMany = vi.mocked(prisma.ticket.updateMany);
const mockedExecute = vi.mocked(executeTicketTransition);

function jobFixture(overrides: {
  command?: string;
  stage?: string;
  autoMode?: boolean;
  workflowType?: string;
} = {}) {
  return {
    id: 1,
    command: overrides.command ?? 'specify',
    ticket: {
      id: 42,
      projectId: 7,
      stage: overrides.stage ?? 'SPECIFY',
      workflowType: overrides.workflowType ?? 'FULL',
      autoMode: overrides.autoMode ?? true,
    },
  };
}

describe('handleAutoTransitionAfterJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUpdateMany.mockResolvedValue({ count: 1 } as never);
    mockedExecute.mockResolvedValue({ ok: true, status: 200, body: {} });
  });

  it('dispatches SPECIFY → PLAN when a specify job completes on SPECIFY', async () => {
    mockedFindJob.mockResolvedValue(jobFixture() as never);

    await handleAutoTransitionAfterJob(1, 'COMPLETED');

    expect(mockedExecute).toHaveBeenCalledWith(7, '42', 'PLAN');
    expect(mockedUpdateMany).not.toHaveBeenCalled();
  });

  it('dispatches PLAN → BUILD when a plan job completes on PLAN', async () => {
    mockedFindJob.mockResolvedValue(
      jobFixture({ command: 'plan', stage: 'PLAN' }) as never
    );

    await handleAutoTransitionAfterJob(1, 'COMPLETED');

    expect(mockedExecute).toHaveBeenCalledWith(7, '42', 'BUILD');
  });

  it('disables autoMode when the job is FAILED', async () => {
    mockedFindJob.mockResolvedValue(jobFixture() as never);

    await handleAutoTransitionAfterJob(1, 'FAILED');

    expect(mockedExecute).not.toHaveBeenCalled();
    expect(mockedUpdateMany).toHaveBeenCalledWith({
      where: { id: 42, autoMode: true },
      data: { autoMode: false },
    });
  });

  it('disables autoMode when the job is CANCELLED', async () => {
    mockedFindJob.mockResolvedValue(jobFixture() as never);

    await handleAutoTransitionAfterJob(1, 'CANCELLED');

    expect(mockedExecute).not.toHaveBeenCalled();
    expect(mockedUpdateMany).toHaveBeenCalledWith({
      where: { id: 42, autoMode: true },
      data: { autoMode: false },
    });
  });

  it('disables autoMode when the dispatch fails', async () => {
    mockedFindJob.mockResolvedValue(jobFixture() as never);
    mockedExecute.mockResolvedValue({
      ok: false,
      status: 400,
      body: { error: 'boom' },
    });

    await handleAutoTransitionAfterJob(1, 'COMPLETED');

    expect(mockedUpdateMany).toHaveBeenCalledWith({
      where: { id: 42, autoMode: true },
      data: { autoMode: false },
    });
  });

  it('disables autoMode when the dispatch throws', async () => {
    mockedFindJob.mockResolvedValue(jobFixture() as never);
    mockedExecute.mockRejectedValue(new Error('network error'));

    await handleAutoTransitionAfterJob(1, 'COMPLETED');

    expect(mockedUpdateMany).toHaveBeenCalledWith({
      where: { id: 42, autoMode: true },
      data: { autoMode: false },
    });
  });

  it('no-ops when autoMode is false', async () => {
    mockedFindJob.mockResolvedValue(jobFixture({ autoMode: false }) as never);

    await handleAutoTransitionAfterJob(1, 'COMPLETED');

    expect(mockedExecute).not.toHaveBeenCalled();
    expect(mockedUpdateMany).not.toHaveBeenCalled();
  });

  it('no-ops for QUICK-workflow tickets', async () => {
    mockedFindJob.mockResolvedValue(jobFixture({ workflowType: 'QUICK' }) as never);

    await handleAutoTransitionAfterJob(1, 'COMPLETED');

    expect(mockedExecute).not.toHaveBeenCalled();
    expect(mockedUpdateMany).not.toHaveBeenCalled();
  });

  it('ignores comment-* background jobs', async () => {
    mockedFindJob.mockResolvedValue(
      jobFixture({ command: 'comment-specify' }) as never
    );

    await handleAutoTransitionAfterJob(1, 'FAILED');

    expect(mockedExecute).not.toHaveBeenCalled();
    expect(mockedUpdateMany).not.toHaveBeenCalled();
  });

  it('does not dispatch on BUILD/VERIFY — existing workflow handles BUILD → VERIFY', async () => {
    mockedFindJob.mockResolvedValue(
      jobFixture({ command: 'implement', stage: 'BUILD' }) as never
    );

    await handleAutoTransitionAfterJob(1, 'COMPLETED');

    expect(mockedExecute).not.toHaveBeenCalled();
  });

  it('does not dispatch when the completed command does not match the stage', async () => {
    // e.g. rollback-reset completes while stage is still PLAN — we must not
    // re-trigger the chain.
    mockedFindJob.mockResolvedValue(
      jobFixture({ command: 'rollback-reset', stage: 'PLAN' }) as never
    );

    await handleAutoTransitionAfterJob(1, 'COMPLETED');

    expect(mockedExecute).not.toHaveBeenCalled();
  });

  it('no-ops when the job is missing', async () => {
    mockedFindJob.mockResolvedValue(null as never);

    await handleAutoTransitionAfterJob(1, 'COMPLETED');

    expect(mockedExecute).not.toHaveBeenCalled();
    expect(mockedUpdateMany).not.toHaveBeenCalled();
  });
});
