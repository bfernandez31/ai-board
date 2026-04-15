import { Stage, type Job, type WorkflowType, type Prisma } from '@prisma/client';
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

type TicketWithJobs = {
  id: number;
  stage: string;
  workflowType: string;
  ticketKey: string;
  projectId: number;
  branch: string | null;
  version: number;
  jobs?: Job[];
};

/** Discriminated result returned by executeTicketTransition. */
export type TransitionExecutionResult =
  | { ok: true; status: number; body: Record<string, unknown> }
  | { ok: false; status: number; body: Record<string, unknown> };

/** Validate a rollback attempt; return null when allowed, or the error body when denied. */
function validateRollback(
  ticket: TicketWithJobs,
  targetStage: Stage,
  validator: (
    stage: Stage,
    target: Stage,
    wt: WorkflowType,
    job: RollbackJob | null
  ) => RollbackValidation
): { denied: { status: number; body: Record<string, unknown> } } | { mostRecentJob: Job | null } {
  const mostRecentJob = ticket.jobs?.[0] || null;
  const validation = validator(
    ticket.stage as Stage,
    targetStage,
    ticket.workflowType as WorkflowType,
    mostRecentJob
  );
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
  })) as TicketWithJobs | null;

  if (!ticket) {
    return { ok: false, status: 404, body: { error: 'Ticket not found' } };
  }

  const isRollbackToInboxAttempt = ticket.stage === 'BUILD' && targetStage === 'INBOX';
  const isRollbackToPlanAttempt = ticket.stage === 'VERIFY' && targetStage === 'PLAN';
  const isSpecifyToInbox = ticket.stage === 'SPECIFY' && targetStage === 'INBOX';
  const isPlanToSpecify = ticket.stage === 'PLAN' && targetStage === 'SPECIFY';
  const isBuildToPlan = ticket.stage === 'BUILD' && targetStage === 'PLAN';
  const isVerifyToBuild = ticket.stage === 'VERIFY' && targetStage === 'BUILD';

  // BUILD → INBOX rollback (QUICK workflow)
  if (isRollbackToInboxAttempt) {
    const result = validateRollback(ticket, targetStage, canRollbackToInbox);
    if ('denied' in result) return { ok: false, ...result.denied };

    const updatedTicket = await rollbackTransaction(
      ticket.id,
      { stage: 'INBOX', workflowType: 'FULL', branch: null, version: 1 },
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
  if (isRollbackToPlanAttempt) {
    const result = validateRollback(ticket, targetStage, canRollbackToPlan);
    if ('denied' in result) return { ok: false, ...result.denied };

    const ticketWithProject = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      include: { project: true },
    });
    if (!ticketWithProject) {
      return { ok: false, status: 404, body: { error: 'Ticket not found' } };
    }

    const updatedTicket = await rollbackTransaction(
      ticket.id,
      { stage: 'PLAN', previewUrl: null, version: { increment: 1 } },
      result.mostRecentJob
    );

    let resetJobId: number | undefined;
    if (updatedTicket.branch) {
      try {
        const effectiveAgent = resolveEffectiveAgent(ticketWithProject);
        const dispatchResult = await dispatchRollbackResetWorkflow({
          ticketId: updatedTicket.id,
          ticketKey: ticket.ticketKey,
          projectId: ticket.projectId,
          branch: updatedTicket.branch,
          githubOwner: ticketWithProject.project.githubOwner,
          githubRepo: ticketWithProject.project.githubRepo,
          provider: AGENT_PROVIDER_MAP[effectiveAgent],
        });
        resetJobId = dispatchResult.jobId;
      } catch (dispatchError) {
        console.error('[Transition] Failed to dispatch rollback-reset workflow:', dispatchError);
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

  // SPECIFY → INBOX: Delete branch (if exists), reset ticket to INBOX
  if (isSpecifyToInbox) {
    const result = validateRollback(ticket, targetStage, canRollbackSpecifyToInbox);
    if ('denied' in result) return { ok: false, ...result.denied };

    if (ticket.branch) {
      try {
        const ticketWithProject = await prisma.ticket.findUnique({
          where: { id: ticket.id },
          include: { project: true },
        });
        if (ticketWithProject) {
          const { deleteBranchAndPRs } = await import('@/lib/github/delete-branch-and-prs');
          const { Octokit } = await import('@octokit/rest');
          const githubToken = process.env.GITHUB_TOKEN;
          if (githubToken) {
            const octokit = new Octokit({ auth: githubToken });
            await deleteBranchAndPRs(
              octokit,
              ticketWithProject.project.githubOwner,
              ticketWithProject.project.githubRepo,
              ticket.branch
            );
          }
        }
      } catch (branchError) {
        console.error('[Transition] Failed to delete branch for SPECIFY→INBOX:', branchError);
      }
    }

    const updatedTicket = await rollbackTransaction(
      ticket.id,
      { stage: 'INBOX', branch: null, workflowType: 'FULL', version: 1 },
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
  if (isPlanToSpecify) {
    const result = validateRollback(ticket, targetStage, canRollbackPlanToSpecify);
    if ('denied' in result) return { ok: false, ...result.denied };

    const updatedTicket = await rollbackTransaction(
      ticket.id,
      { stage: 'SPECIFY', version: { increment: 1 } },
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
  if (isBuildToPlan) {
    const result = validateRollback(ticket, targetStage, canRollbackBuildToPlan);
    if ('denied' in result) return { ok: false, ...result.denied };

    const ticketWithProject = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      include: { project: true },
    });
    if (!ticketWithProject) {
      return { ok: false, status: 404, body: { error: 'Ticket not found' } };
    }

    const updatedTicket = await rollbackTransaction(
      ticket.id,
      { stage: 'PLAN', previewUrl: null, version: { increment: 1 } },
      result.mostRecentJob
    );

    let resetJobId: number | undefined;
    if (updatedTicket.branch) {
      try {
        const effectiveAgent = resolveEffectiveAgent(ticketWithProject);
        const dispatchResult = await dispatchRollbackResetWorkflow({
          ticketId: updatedTicket.id,
          ticketKey: ticket.ticketKey,
          projectId: ticket.projectId,
          branch: updatedTicket.branch,
          githubOwner: ticketWithProject.project.githubOwner,
          githubRepo: ticketWithProject.project.githubRepo,
          stage: 'build',
          provider: AGENT_PROVIDER_MAP[effectiveAgent],
        });
        resetJobId = dispatchResult.jobId;
      } catch (dispatchError) {
        console.error('[Transition] Failed to dispatch rollback-reset for BUILD→PLAN:', dispatchError);
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

  // VERIFY → BUILD: Stage change only
  if (isVerifyToBuild) {
    const result = validateRollback(ticket, targetStage, canRollbackVerifyToBuild);
    if ('denied' in result) return { ok: false, ...result.denied };

    const updatedTicket = await rollbackTransaction(
      ticket.id,
      { stage: 'BUILD', version: { increment: 1 } },
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
  const ticketWithProject = await prisma.ticket.findUnique({
    where: { id: ticket.id },
    include: { project: true },
  });

  if (!ticketWithProject) {
    return { ok: false, status: 404, body: { error: 'Ticket not found' } };
  }

  const isQuickImpl = ticket.stage === 'INBOX' && targetStage === 'BUILD';

  const transitionResult = await handleTicketTransition(ticketWithProject, targetStage);

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

  let currentVersion = ticket.version;
  if (isQuickImpl) {
    const refreshedTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      select: { version: true },
    });
    currentVersion = refreshedTicket?.version || ticket.version;
  }

  try {
    const updatedTicket = await prisma.ticket.update({
      where: { id: ticket.id, version: currentVersion },
      data: { stage: targetStage, version: { increment: 1 } },
    });

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
