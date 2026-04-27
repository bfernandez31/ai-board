import { Stage, type Job, type Project, type Ticket, type WorkflowType, type Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import {
  canRollbackToInbox,
  canRollbackToPlan,
  canRollbackSpecifyToInbox,
  canRollbackPlanToSpecify,
  canRollbackBuildToPlan,
  canRollbackVerifyToBuild,
  type RollbackValidation,
  type Job as RollbackJob,
} from '@/app/lib/workflows/rollback-validator';
import { handleTicketTransition, cleanupOrphanedJob, resolveEffectiveAgent } from '@/lib/workflows/transition';
import { resolveTicketWithRelations } from '@/app/lib/utils/ticket-resolver';
import { dispatchRollbackResetWorkflow } from '@/app/lib/workflows/dispatch-rollback-reset';
import { AGENT_PROVIDER_MAP } from '@/lib/ai-credentials/types';
import { captureOutcomeOnShip } from '@/lib/outcomes/capture';

type TicketWithJobsAndProject = Ticket & {
  project: Project;
  jobs?: Job[];
};

/** Discriminated result returned by executeTicketTransition. */
export type TransitionExecutionResult =
  | { ok: true; status: number; body: Record<string, unknown> }
  | { ok: false; status: number; body: Record<string, unknown> };

/** Validate a rollback attempt; return null when allowed, or the error body when denied. */
function validateRollback(
  ticket: TicketWithJobsAndProject,
  targetStage: Stage,
  validator: (
    stage: Stage,
    target: Stage,
    wt: WorkflowType,
    job: RollbackJob | null
  ) => RollbackValidation
): { denied: { status: number; body: Record<string, unknown> } } | { mostRecentJob: Job | null } {
  const mostRecentJob = ticket.jobs?.[0] || null;
  const validation = validator(ticket.stage, targetStage, ticket.workflowType, mostRecentJob);
  if (!validation.allowed) {
    return { denied: { status: 400, body: { error: validation.reason } } };
  }
  return { mostRecentJob };
}

/** Common rollback transaction: update ticket and delete most recent job. */
async function rollbackTransaction(
  ticketId: number,
  updateData: Prisma.TicketUpdateInput,
  mostRecentJob: Job | null
) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({ where: { id: ticketId }, data: updateData });
    if (mostRecentJob) {
      await tx.job.delete({ where: { id: mostRecentJob.id } });
    }
    return updated;
  });
}

/**
 * Rollback to PLAN with a git-reset workflow dispatch.
 *
 * Shared between VERIFY→PLAN and BUILD→PLAN which run the same sequence:
 * transaction (update ticket + delete most recent job) → dispatch rollback-reset.
 * Dispatch failures after a successful mutation return DISPATCH_FAILED_AFTER_MUTATION.
 */
async function rollbackToPlanWithReset(
  ticket: TicketWithJobsAndProject,
  mostRecentJob: Job | null,
  resetStage: 'build' | undefined,
  logLabel: string
): Promise<TransitionExecutionResult> {
  const updatedTicket = await rollbackTransaction(
    ticket.id,
    { stage: 'PLAN', previewUrl: null, autoMode: false, version: { increment: 1 } },
    mostRecentJob
  );

  let resetJobId: number | undefined;
  if (updatedTicket.branch) {
    try {
      const effectiveAgent = resolveEffectiveAgent(ticket);
      const dispatchResult = await dispatchRollbackResetWorkflow({
        ticketId: updatedTicket.id,
        ticketKey: ticket.ticketKey,
        projectId: ticket.projectId,
        branch: updatedTicket.branch,
        githubOwner: ticket.project.githubOwner,
        githubRepo: ticket.project.githubRepo,
        ...(resetStage && { stage: resetStage }),
        provider: AGENT_PROVIDER_MAP[effectiveAgent],
      });
      resetJobId = dispatchResult.jobId;
    } catch (dispatchError) {
      console.error(`[Transition] ${logLabel}:`, dispatchError);
      return {
        ok: false,
        status: 500,
        body: {
          error: 'Rollback-reset workflow dispatch failed after stage transition to PLAN',
          code: 'DISPATCH_FAILED_AFTER_MUTATION',
          stage: updatedTicket.stage,
          ticketId: updatedTicket.id,
        },
      };
    }
  }

  return {
    ok: true,
    status: 200,
    body: {
      id: updatedTicket.id,
      stage: updatedTicket.stage,
      workflowType: updatedTicket.workflowType,
      branch: updatedTicket.branch,
      version: updatedTicket.version,
      previewUrl: updatedTicket.previewUrl,
      updatedAt: updatedTicket.updatedAt.toISOString(),
      resetJobId,
    },
  };
}

/**
 * Execute a stage transition (forward or rollback) for a ticket.
 *
 * Resolves the ticket by id or ticketKey, classifies the requested
 * transition, and runs the matching branch (rollback rules + optional
 * GitHub dispatch + optimistic-concurrency update). Returns a discriminated
 * result describing the HTTP status + body.
 */
export async function executeTicketTransition(
  projectId: number,
  ticketIdentifier: string,
  targetStage: Stage
): Promise<TransitionExecutionResult> {
  const ticket = (await resolveTicketWithRelations(projectId, ticketIdentifier, {
    project: true,
    jobs: {
      where: {
        command: {
          not: {
            startsWith: 'comment-',
          },
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
      take: 1,
    },
  })) as TicketWithJobsAndProject | null;

  if (!ticket) {
    return { ok: false, status: 404, body: { error: 'Ticket not found' } };
  }

  // BUILD → INBOX rollback (QUICK workflow)
  if (ticket.stage === Stage.BUILD && targetStage === Stage.INBOX) {
    const result = validateRollback(ticket, targetStage, canRollbackToInbox);
    if ('denied' in result) return { ok: false, ...result.denied };

    const updatedTicket = await rollbackTransaction(
      ticket.id,
      { stage: Stage.INBOX, workflowType: 'FULL', branch: null, version: 1 },
      result.mostRecentJob
    );

    return {
      ok: true,
      status: 200,
      body: {
        id: updatedTicket.id,
        stage: updatedTicket.stage,
        workflowType: updatedTicket.workflowType,
        branch: updatedTicket.branch,
        version: updatedTicket.version,
        updatedAt: updatedTicket.updatedAt.toISOString(),
      },
    };
  }

  // VERIFY → PLAN rollback (FULL workflow, dispatches rollback-reset)
  if (ticket.stage === Stage.VERIFY && targetStage === Stage.PLAN) {
    const result = validateRollback(ticket, targetStage, canRollbackToPlan);
    if ('denied' in result) return { ok: false, ...result.denied };

    return rollbackToPlanWithReset(
      ticket,
      result.mostRecentJob,
      undefined,
      'Failed to dispatch rollback-reset workflow'
    );
  }

  // SPECIFY → INBOX: Delete branch (if exists), reset ticket to INBOX
  if (ticket.stage === Stage.SPECIFY && targetStage === Stage.INBOX) {
    const result = validateRollback(ticket, targetStage, canRollbackSpecifyToInbox);
    if ('denied' in result) return { ok: false, ...result.denied };

    if (ticket.branch) {
      try {
        const { deleteBranchAndPRs } = await import('@/lib/github/delete-branch-and-prs');
        const { Octokit } = await import('@octokit/rest');
        const githubToken = process.env.GITHUB_TOKEN;
        if (githubToken) {
          const octokit = new Octokit({ auth: githubToken });
          await deleteBranchAndPRs(
            octokit,
            ticket.project.githubOwner,
            ticket.project.githubRepo,
            ticket.branch
          );
        }
      } catch (branchError) {
        console.error('[Transition] Failed to delete branch for SPECIFY→INBOX:', branchError);
      }
    }

    const updatedTicket = await rollbackTransaction(
      ticket.id,
      { stage: Stage.INBOX, branch: null, workflowType: 'FULL', version: 1 },
      result.mostRecentJob
    );

    return {
      ok: true,
      status: 200,
      body: {
        id: updatedTicket.id,
        stage: updatedTicket.stage,
        workflowType: updatedTicket.workflowType,
        branch: updatedTicket.branch,
        version: updatedTicket.version,
        updatedAt: updatedTicket.updatedAt.toISOString(),
      },
    };
  }

  // PLAN → SPECIFY: Stage change only
  if (ticket.stage === Stage.PLAN && targetStage === Stage.SPECIFY) {
    const result = validateRollback(ticket, targetStage, canRollbackPlanToSpecify);
    if ('denied' in result) return { ok: false, ...result.denied };

    const updatedTicket = await rollbackTransaction(
      ticket.id,
      { stage: Stage.SPECIFY, version: { increment: 1 } },
      result.mostRecentJob
    );

    return {
      ok: true,
      status: 200,
      body: {
        id: updatedTicket.id,
        stage: updatedTicket.stage,
        version: updatedTicket.version,
        updatedAt: updatedTicket.updatedAt.toISOString(),
      },
    };
  }

  // BUILD → PLAN: Backup tag + git reset via rollback-reset workflow
  if (ticket.stage === Stage.BUILD && targetStage === Stage.PLAN) {
    const result = validateRollback(ticket, targetStage, canRollbackBuildToPlan);
    if ('denied' in result) return { ok: false, ...result.denied };

    return rollbackToPlanWithReset(
      ticket,
      result.mostRecentJob,
      'build',
      'Failed to dispatch rollback-reset for BUILD→PLAN'
    );
  }

  // VERIFY → BUILD: Stage change only
  if (ticket.stage === Stage.VERIFY && targetStage === Stage.BUILD) {
    const result = validateRollback(ticket, targetStage, canRollbackVerifyToBuild);
    if ('denied' in result) return { ok: false, ...result.denied };

    const updatedTicket = await rollbackTransaction(
      ticket.id,
      { stage: Stage.BUILD, version: { increment: 1 } },
      result.mostRecentJob
    );

    return {
      ok: true,
      status: 200,
      body: {
        id: updatedTicket.id,
        stage: updatedTicket.stage,
        version: updatedTicket.version,
        updatedAt: updatedTicket.updatedAt.toISOString(),
      },
    };
  }

  // Forward transition
  const isQuickImpl = ticket.stage === Stage.INBOX && targetStage === Stage.BUILD;

  // Re-read ticket immediately before dispatch to avoid dispatching a workflow with a
  // stale snapshot. Without this, concurrent transitions could dispatch GitHub workflows
  // built from outdated stage/workflowType/branch/attachments while the local optimistic
  // update only cleans up the DB job row — leaving the external workflow running untracked.
  const freshTicket = await prisma.ticket.findUnique({
    where: { id: ticket.id },
    include: { project: true },
  });

  if (!freshTicket || freshTicket.version !== ticket.version || freshTicket.stage !== ticket.stage) {
    return {
      ok: false,
      status: 409,
      body: { error: 'Ticket was modified by another request. Please refresh and try again.' },
    };
  }

  const transitionResult = await handleTicketTransition(freshTicket, targetStage);

  if (!transitionResult.success) {
    return {
      ok: false,
      status: 400,
      body: {
        error: transitionResult.error || 'Transition failed',
        code: transitionResult.errorCode,
        message: transitionResult.error,
        details: transitionResult.details,
      },
    };
  }

  // QUICK_IMPL bumps version inside handleTicketTransition (workflowType update),
  // so we must re-read before the final optimistic update.
  let currentVersion = freshTicket.version;
  if (isQuickImpl) {
    const refreshedTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      select: { version: true },
    });
    currentVersion = refreshedTicket?.version || freshTicket.version;
  }

  try {
    const updatedTicket = await prisma.ticket.update({
      where: { id: ticket.id, version: currentVersion },
      data: { stage: targetStage, version: { increment: 1 } },
    });

    if (targetStage === Stage.SHIP) {
      void captureOutcomeOnShip({
        ticketId: updatedTicket.id,
        projectId: updatedTicket.projectId,
        workflowType: updatedTicket.workflowType,
        shippedAt: updatedTicket.updatedAt,
      }).catch((err) => {
        console.error('[outcome-capture] unhandled', { ticketId: updatedTicket.id, err });
      });
    }

    return {
      ok: true,
      status: 200,
      body: {
        id: updatedTicket.id,
        stage: updatedTicket.stage,
        workflowType: updatedTicket.workflowType,
        branch: updatedTicket.branch,
        version: updatedTicket.version,
        updatedAt: updatedTicket.updatedAt.toISOString(),
        jobId: transitionResult.jobId,
      },
    };
  } catch (updateError: unknown) {
    if (
      updateError &&
      typeof updateError === 'object' &&
      'code' in updateError &&
      updateError.code === 'P2025'
    ) {
      if (transitionResult.jobId) {
        await cleanupOrphanedJob(transitionResult.jobId);
      }
      return {
        ok: false,
        status: 409,
        body: { error: 'Ticket was modified by another request. Please refresh and try again.' },
      };
    }
    throw updateError;
  }
}
