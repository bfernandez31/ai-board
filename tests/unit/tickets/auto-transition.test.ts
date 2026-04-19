/**
 * Unit Tests: Auto-transition helper (AIB-689)
 *
 * Covers the server-side behavior that reacts to a terminal job status on a
 * ticket with autoMode enabled: dispatch next stage on success, disable on
 * failure or dispatch error.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  prisma: {
    job: { findUnique: vi.fn() },
    ticket: { update: vi.fn() },
  },
}));

vi.mock('@/lib/tickets/transition', () => ({
  executeTicketTransition: vi.fn(),
}));

import { prisma } from '@/lib/db/client';
import { executeTicketTransition } from '@/lib/tickets/transition';
import { handleAutoTransitionOnJobComplete } from '@/lib/tickets/auto-transition';

const mockedFindJob = vi.mocked(prisma.job.findUnique);
const mockedUpdateTicket = vi.mocked(prisma.ticket.update);
const mockedExecuteTransition = vi.mocked(executeTicketTransition);

interface JobRecord {
  command: string;
  ticket: {
    id: number;
    projectId: number;
    ticketKey: string;
    stage: string;
    autoMode: boolean;
    workflowType: 'FULL' | 'QUICK' | 'CLEAN';
  };
}

function makeJob(overrides: Partial<JobRecord['ticket']> & { command?: string } = {}): JobRecord {
  const { command = 'specify', ...ticketOverrides } = overrides;
  return {
    command,
    ticket: {
      id: 1,
      projectId: 10,
      ticketKey: 'AIB-123',
      stage: 'SPECIFY',
      autoMode: true,
      workflowType: 'FULL',
      ...ticketOverrides,
    },
  };
}

describe('handleAutoTransitionOnJobComplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedExecuteTransition.mockResolvedValue({ ok: true, status: 200, body: {} });
  });

  it('dispatches next stage when a specify job completes on a SPECIFY ticket with autoMode', async () => {
    mockedFindJob.mockResolvedValue(makeJob({ stage: 'SPECIFY', command: 'specify' }) as never);

    await handleAutoTransitionOnJobComplete(42, 'COMPLETED');

    expect(mockedExecuteTransition).toHaveBeenCalledWith(10, 'AIB-123', 'PLAN');
    expect(mockedUpdateTicket).not.toHaveBeenCalled();
  });

  it('dispatches BUILD when a plan job completes on a PLAN ticket with autoMode', async () => {
    mockedFindJob.mockResolvedValue(makeJob({ stage: 'PLAN', command: 'plan' }) as never);

    await handleAutoTransitionOnJobComplete(42, 'COMPLETED');

    expect(mockedExecuteTransition).toHaveBeenCalledWith(10, 'AIB-123', 'BUILD');
  });

  it('does not dispatch when autoMode is off', async () => {
    mockedFindJob.mockResolvedValue(makeJob({ autoMode: false }) as never);

    await handleAutoTransitionOnJobComplete(42, 'COMPLETED');

    expect(mockedExecuteTransition).not.toHaveBeenCalled();
    expect(mockedUpdateTicket).not.toHaveBeenCalled();
  });

  it('does not dispatch on QUICK workflow tickets', async () => {
    mockedFindJob.mockResolvedValue(
      makeJob({ workflowType: 'QUICK', stage: 'SPECIFY' }) as never
    );

    await handleAutoTransitionOnJobComplete(42, 'COMPLETED');

    expect(mockedExecuteTransition).not.toHaveBeenCalled();
  });

  it('does not dispatch on BUILD or VERIFY stages (already auto-progressing)', async () => {
    mockedFindJob.mockResolvedValue(makeJob({ stage: 'BUILD', command: 'implement' }) as never);
    await handleAutoTransitionOnJobComplete(42, 'COMPLETED');

    mockedFindJob.mockResolvedValue(makeJob({ stage: 'VERIFY', command: 'verify' }) as never);
    await handleAutoTransitionOnJobComplete(43, 'COMPLETED');

    expect(mockedExecuteTransition).not.toHaveBeenCalled();
  });

  it('ignores comment-* AI-BOARD jobs', async () => {
    mockedFindJob.mockResolvedValue(makeJob({ command: 'comment-specify' }) as never);

    await handleAutoTransitionOnJobComplete(42, 'COMPLETED');

    expect(mockedExecuteTransition).not.toHaveBeenCalled();
  });

  it('ignores deploy-preview jobs', async () => {
    mockedFindJob.mockResolvedValue(makeJob({ command: 'deploy-preview' }) as never);

    await handleAutoTransitionOnJobComplete(42, 'COMPLETED');

    expect(mockedExecuteTransition).not.toHaveBeenCalled();
  });

  it('disables autoMode when a workflow job FAILS', async () => {
    mockedFindJob.mockResolvedValue(makeJob({ stage: 'SPECIFY' }) as never);

    await handleAutoTransitionOnJobComplete(42, 'FAILED');

    expect(mockedUpdateTicket).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { autoMode: false },
    });
    expect(mockedExecuteTransition).not.toHaveBeenCalled();
  });

  it('disables autoMode when a workflow job is CANCELLED', async () => {
    mockedFindJob.mockResolvedValue(makeJob({ stage: 'PLAN', command: 'plan' }) as never);

    await handleAutoTransitionOnJobComplete(42, 'CANCELLED');

    expect(mockedUpdateTicket).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { autoMode: false },
    });
    expect(mockedExecuteTransition).not.toHaveBeenCalled();
  });

  it('disables autoMode on FAILED even for BUILD-stage jobs', async () => {
    mockedFindJob.mockResolvedValue(makeJob({ stage: 'BUILD', command: 'implement' }) as never);

    await handleAutoTransitionOnJobComplete(42, 'FAILED');

    expect(mockedUpdateTicket).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { autoMode: false },
    });
  });

  it('disables autoMode when dispatch of next transition fails', async () => {
    mockedFindJob.mockResolvedValue(makeJob({ stage: 'SPECIFY' }) as never);
    mockedExecuteTransition.mockResolvedValue({
      ok: false,
      status: 400,
      body: { error: 'Missing credential' },
    });

    await handleAutoTransitionOnJobComplete(42, 'COMPLETED');

    expect(mockedExecuteTransition).toHaveBeenCalled();
    expect(mockedUpdateTicket).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { autoMode: false },
    });
  });

  it('does nothing when job is not found', async () => {
    mockedFindJob.mockResolvedValue(null);

    await handleAutoTransitionOnJobComplete(999, 'COMPLETED');

    expect(mockedExecuteTransition).not.toHaveBeenCalled();
    expect(mockedUpdateTicket).not.toHaveBeenCalled();
  });
});
