import type { Stage } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { getNextStage, Stage as ValidationStage } from '@/lib/stage-transitions';
import { executeTicketTransition } from '@/lib/tickets/transition';
import { isAutoModeEligible } from '@/app/lib/tickets/auto-mode-eligibility';
import { isTerminalStatus, type JobStatus } from '@/app/lib/job-state-machine';

export interface AutoModeToggleInput {
  projectId: number;
  ticketIdentifier: string;
}

export interface AutoModeToggleResult {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
}

export interface AutoModeHookInput {
  jobId: number;
  terminalStatus: 'COMPLETED' | 'FAILED' | 'CANCELLED';
}

async function findTicket(projectId: number, identifier: string) {
  const numericId = parseInt(identifier, 10);
  if (!isNaN(numericId)) {
    return prisma.ticket.findFirst({
      where: { id: numericId, projectId },
      select: {
        id: true,
        stage: true,
        workflowType: true,
        autoMode: true,
        projectId: true,
        ticketKey: true,
      },
    });
  }
  return prisma.ticket.findFirst({
    where: { ticketKey: identifier, projectId },
    select: {
      id: true,
      stage: true,
      workflowType: true,
      autoMode: true,
      projectId: true,
      ticketKey: true,
    },
  });
}

/**
 * Enable auto-mode on a ticket.
 *
 * - Validates eligibility (FR-001/003/004).
 * - Detects running/pending non-`comment-*` jobs. If none are running, dispatches
 *   the next transition via `executeTicketTransition`. On dispatch failure,
 *   reverts `autoMode` to `false` (FR-021).
 * - If a job is already running, sets `autoMode=true` only (FR-011).
 */
export async function enableAutoMode(
  input: AutoModeToggleInput
): Promise<AutoModeToggleResult> {
  const ticket = await findTicket(input.projectId, input.ticketIdentifier);

  if (!ticket) {
    return { ok: false, status: 404, body: { error: 'Ticket not found' } };
  }

  if (!isAutoModeEligible(ticket)) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'Auto-mode is only available on FULL-workflow tickets in INBOX, SPECIFY, or PLAN.',
        code: 'AUTO_MODE_INELIGIBLE',
      },
    };
  }

  if (ticket.autoMode === true) {
    return {
      ok: true,
      status: 200,
      body: {
        autoMode: true,
        ticketId: ticket.id,
        stage: ticket.stage,
        jobId: null,
      },
    };
  }

  const runningJob = await prisma.job.findFirst({
    where: {
      ticketId: ticket.id,
      status: { in: ['PENDING', 'RUNNING'] },
      NOT: { command: { startsWith: 'comment-' } },
    },
    select: { id: true },
  });

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { autoMode: true },
  });

  if (runningJob) {
    return {
      ok: true,
      status: 200,
      body: {
        autoMode: true,
        ticketId: ticket.id,
        stage: ticket.stage,
      },
    };
  }

  const nextStage = getNextStage(ticket.stage as unknown as ValidationStage);
  if (!nextStage) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { autoMode: false },
    });
    return {
      ok: false,
      status: 400,
      body: {
        error: 'No next stage available for auto-mode dispatch.',
        code: 'AUTO_MODE_INELIGIBLE',
      },
    };
  }

  const dispatchResult = await executeTicketTransition(
    ticket.projectId,
    String(ticket.id),
    nextStage as unknown as Stage
  );

  if (!dispatchResult.ok) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { autoMode: false },
    });
    return {
      ok: false,
      status: dispatchResult.status,
      body: dispatchResult.body,
    };
  }

  const dispatchedJobId =
    typeof dispatchResult.body.jobId === 'number'
      ? dispatchResult.body.jobId
      : undefined;

  return {
    ok: true,
    status: 200,
    body: {
      autoMode: true,
      ticketId: ticket.id,
      stage: dispatchResult.body.stage ?? nextStage,
      ...(dispatchedJobId != null ? { jobId: dispatchedJobId } : {}),
    },
  };
}

/**
 * Disable auto-mode on a ticket. Never touches Job rows (FR-014).
 */
export async function disableAutoMode(
  input: AutoModeToggleInput
): Promise<AutoModeToggleResult> {
  const ticket = await findTicket(input.projectId, input.ticketIdentifier);

  if (!ticket) {
    return { ok: false, status: 404, body: { error: 'Ticket not found' } };
  }

  if (ticket.autoMode === false) {
    return {
      ok: true,
      status: 200,
      body: { autoMode: false, ticketId: ticket.id, stage: ticket.stage },
    };
  }

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { autoMode: false },
  });

  return {
    ok: true,
    status: 200,
    body: { autoMode: false, ticketId: ticket.id, stage: ticket.stage },
  };
}

/**
 * Fire-and-log hook invoked after a job reaches a terminal status.
 *
 * - Skips `comment-*` jobs (they never drive the chain).
 * - On FAILED/CANCELLED + autoMode=true → disengages auto-mode (FR-018/019).
 * - On COMPLETED + autoMode=true + eligible stage (SPECIFY/PLAN) → dispatches
 *   the next stage via `executeTicketTransition`. On dispatch failure, logs and
 *   disengages auto-mode (FR-021).
 *
 * Never throws — the outer PATCH has already persisted the job row and must
 * return 200 regardless of this hook's outcome.
 */
export async function handleJobCompletionAutoTransition(
  input: AutoModeHookInput
): Promise<void> {
  const { jobId, terminalStatus } = input;

  if (!isTerminalStatus(terminalStatus as JobStatus)) {
    return;
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      command: true,
      ticket: {
        select: {
          id: true,
          projectId: true,
          stage: true,
          workflowType: true,
          autoMode: true,
        },
      },
    },
  });

  if (!job || !job.ticket) return;
  if (job.command.startsWith('comment-')) return;

  const ticket = job.ticket;

  if (terminalStatus === 'FAILED' || terminalStatus === 'CANCELLED') {
    if (ticket.autoMode) {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { autoMode: false },
      });
      console.log('[AutoMode] Disengaged after terminal status', {
        ticketId: ticket.id,
        terminalStatus,
      });
    }
    return;
  }

  if (!ticket.autoMode) return;
  if (!isAutoModeEligible(ticket)) return;
  if (ticket.stage !== 'SPECIFY' && ticket.stage !== 'PLAN') return;

  const nextStage = getNextStage(ticket.stage as unknown as ValidationStage);
  if (!nextStage) return;

  const result = await executeTicketTransition(
    ticket.projectId,
    String(ticket.id),
    nextStage as unknown as Stage
  );

  if (!result.ok) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { autoMode: false },
    });
    console.error('[AutoMode] Dispatch failed during auto-chain; disengaged.', {
      ticketId: ticket.id,
      status: result.status,
      body: result.body,
    });
    return;
  }

  console.log('[AutoMode] Advanced to next stage', {
    ticketId: ticket.id,
    nextStage,
  });
}
