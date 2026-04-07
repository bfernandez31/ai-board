import { NextRequest, NextResponse } from 'next/server';
import { Stage, type Job, type WorkflowType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import type { Prisma } from '@prisma/client';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { verifyWorkflowToken } from '@/app/lib/auth/workflow-auth';
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
import { handleTicketTransition, cleanupOrphanedJob } from '@/lib/workflows/transition';
import { resolveTicketWithRelations } from '@/app/lib/utils/ticket-resolver';
import { dispatchRollbackResetWorkflow } from '@/app/lib/workflows/dispatch-rollback-reset';
import { AGENT_PROVIDER_MAP } from '@/lib/ai-credentials/types';
import { resolveEffectiveAgent } from '@/lib/workflows/transition';

type TicketWithJobs = { id: number; stage: string; workflowType: string; ticketKey: string; projectId: number; branch: string | null; jobs?: Job[] };

/** Extract most recent job and run validator. Returns error response or the job. */
function validateRollback(
  ticket: TicketWithJobs,
  targetStage: Stage,
  validator: (stage: Stage, target: Stage, wt: WorkflowType, job: RollbackJob | null) => RollbackValidation
): { error: NextResponse } | { mostRecentJob: Job | null } {
  const mostRecentJob = (ticket as TicketWithJobs & { jobs: Job[] }).jobs?.[0] || null;
  const validation = validator(ticket.stage as Stage, targetStage, ticket.workflowType as WorkflowType, mostRecentJob);
  if (!validation.allowed) {
    return { error: NextResponse.json({ error: validation.reason }, { status: 400 }) };
  }
  return { mostRecentJob };
}

/** Common transaction: update ticket and delete most recent job. */
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

const TransitionRequestSchema = z.object({
  targetStage: z.enum(['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP']),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdentifier } = params;
    const projectId = parseInt(projectIdString, 10);

    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    const isWorkflowAuth = await verifyWorkflowToken(request);
    if (!isWorkflowAuth) {
      try {
        await verifyProjectAccess(projectId, request);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Unauthorized') {
            return NextResponse.json(
              { error: 'Unauthorized', code: 'AUTH_ERROR' },
              { status: 401 }
            );
          }
          if (error.message === 'Project not found') {
            return NextResponse.json(
              { error: 'Project not found', code: 'NOT_FOUND' },
              { status: 404 }
            );
          }
        }
        throw error;
      }
    }

    const body = await request.json();
    const parseResult = TransitionRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { targetStage } = parseResult.data;

    const ticket = await resolveTicketWithRelations(projectId, ticketIdentifier, {
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
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const isRollbackToInboxAttempt = ticket.stage === 'BUILD' && targetStage === 'INBOX';
    const isRollbackToPlanAttempt = ticket.stage === 'VERIFY' && targetStage === 'PLAN';
    const isSpecifyToInbox = ticket.stage === 'SPECIFY' && targetStage === 'INBOX';
    const isPlanToSpecify = ticket.stage === 'PLAN' && targetStage === 'SPECIFY';
    const isBuildToPlan = ticket.stage === 'BUILD' && targetStage === 'PLAN';
    const isVerifyToBuild = ticket.stage === 'VERIFY' && targetStage === 'BUILD';

    // BUILD → INBOX rollback (QUICK workflow)
    if (isRollbackToInboxAttempt) {
      const result = validateRollback(ticket, targetStage as Stage, canRollbackToInbox);
      if ('error' in result) return result.error;

      const updatedTicket = await rollbackTransaction(
        ticket.id,
        { stage: 'INBOX', workflowType: 'FULL', branch: null, version: 1 },
        result.mostRecentJob
      );

      return NextResponse.json({
        id: updatedTicket.id, stage: updatedTicket.stage,
        workflowType: updatedTicket.workflowType, branch: updatedTicket.branch,
        version: updatedTicket.version, updatedAt: updatedTicket.updatedAt.toISOString(),
      });
    }

    // VERIFY → PLAN rollback (FULL workflow, dispatches rollback-reset)
    if (isRollbackToPlanAttempt) {
      const result = validateRollback(ticket, targetStage as Stage, canRollbackToPlan);
      if ('error' in result) return result.error;

      const ticketWithProject = await prisma.ticket.findUnique({
        where: { id: ticket.id }, include: { project: true },
      });
      if (!ticketWithProject) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
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
            ticketId: updatedTicket.id, ticketKey: ticket.ticketKey,
            projectId: ticket.projectId, branch: updatedTicket.branch,
            githubOwner: ticketWithProject.project.githubOwner,
            githubRepo: ticketWithProject.project.githubRepo,
            provider: AGENT_PROVIDER_MAP[effectiveAgent],
          });
          resetJobId = dispatchResult.jobId;
        } catch (dispatchError) {
          console.error('[Transition] Failed to dispatch rollback-reset workflow:', dispatchError);
          return NextResponse.json(
            {
              error: 'Rollback-reset workflow dispatch failed after stage transition to PLAN',
              code: 'DISPATCH_FAILED_AFTER_MUTATION',
              stage: updatedTicket.stage,
              ticketId: updatedTicket.id,
            },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        id: updatedTicket.id, stage: updatedTicket.stage,
        workflowType: updatedTicket.workflowType, branch: updatedTicket.branch,
        version: updatedTicket.version, previewUrl: updatedTicket.previewUrl,
        updatedAt: updatedTicket.updatedAt.toISOString(), resetJobId,
      });
    }

    // SPECIFY → INBOX: Delete branch (if exists), reset ticket to INBOX
    if (isSpecifyToInbox) {
      const result = validateRollback(ticket, targetStage as Stage, canRollbackSpecifyToInbox);
      if ('error' in result) return result.error;

      if (ticket.branch) {
        try {
          const ticketWithProject = await prisma.ticket.findUnique({
            where: { id: ticket.id }, include: { project: true },
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

      return NextResponse.json({
        id: updatedTicket.id, stage: updatedTicket.stage,
        workflowType: updatedTicket.workflowType, branch: updatedTicket.branch,
        version: updatedTicket.version, updatedAt: updatedTicket.updatedAt.toISOString(),
      });
    }

    // PLAN → SPECIFY: Stage change only
    if (isPlanToSpecify) {
      const result = validateRollback(ticket, targetStage as Stage, canRollbackPlanToSpecify);
      if ('error' in result) return result.error;

      const updatedTicket = await rollbackTransaction(
        ticket.id,
        { stage: 'SPECIFY', version: { increment: 1 } },
        result.mostRecentJob
      );

      return NextResponse.json({
        id: updatedTicket.id, stage: updatedTicket.stage,
        version: updatedTicket.version, updatedAt: updatedTicket.updatedAt.toISOString(),
      });
    }

    // BUILD → PLAN: Backup tag + git reset via rollback-reset workflow
    if (isBuildToPlan) {
      const result = validateRollback(ticket, targetStage as Stage, canRollbackBuildToPlan);
      if ('error' in result) return result.error;

      const ticketWithProject = await prisma.ticket.findUnique({
        where: { id: ticket.id }, include: { project: true },
      });
      if (!ticketWithProject) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
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
            ticketId: updatedTicket.id, ticketKey: ticket.ticketKey,
            projectId: ticket.projectId, branch: updatedTicket.branch,
            githubOwner: ticketWithProject.project.githubOwner,
            githubRepo: ticketWithProject.project.githubRepo,
            stage: 'build',
            provider: AGENT_PROVIDER_MAP[effectiveAgent],
          });
          resetJobId = dispatchResult.jobId;
        } catch (dispatchError) {
          console.error('[Transition] Failed to dispatch rollback-reset for BUILD→PLAN:', dispatchError);
          return NextResponse.json(
            {
              error: 'Rollback-reset workflow dispatch failed after stage transition to PLAN',
              code: 'DISPATCH_FAILED_AFTER_MUTATION',
              stage: updatedTicket.stage,
              ticketId: updatedTicket.id,
            },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        id: updatedTicket.id, stage: updatedTicket.stage,
        workflowType: updatedTicket.workflowType, branch: updatedTicket.branch,
        version: updatedTicket.version, previewUrl: updatedTicket.previewUrl,
        updatedAt: updatedTicket.updatedAt.toISOString(), resetJobId,
      });
    }

    // VERIFY → BUILD: Stage change only
    if (isVerifyToBuild) {
      const result = validateRollback(ticket, targetStage as Stage, canRollbackVerifyToBuild);
      if ('error' in result) return result.error;

      const updatedTicket = await rollbackTransaction(
        ticket.id,
        { stage: 'BUILD', version: { increment: 1 } },
        result.mostRecentJob
      );

      return NextResponse.json({
        id: updatedTicket.id, stage: updatedTicket.stage,
        version: updatedTicket.version, updatedAt: updatedTicket.updatedAt.toISOString(),
      });
    }

    const ticketWithProject = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      include: { project: true },
    });

    if (!ticketWithProject) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const isQuickImpl = ticket.stage === 'INBOX' && targetStage === 'BUILD';

    const transitionResult = await handleTicketTransition(
      ticketWithProject,
      targetStage as Stage
    );

    if (!transitionResult.success) {
      return NextResponse.json(
        {
          error: transitionResult.error || 'Transition failed',
          code: transitionResult.errorCode,
          message: transitionResult.error,
          details: transitionResult.details,
        },
        { status: 400 }
      );
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
        where: {
          id: ticket.id,
          version: currentVersion,
        },
        data: {
          stage: targetStage as Stage,
          version: { increment: 1 },
        },
      });

      return NextResponse.json({
        id: updatedTicket.id,
        stage: updatedTicket.stage,
        workflowType: updatedTicket.workflowType,
        branch: updatedTicket.branch,
        version: updatedTicket.version,
        updatedAt: updatedTicket.updatedAt.toISOString(),
        jobId: transitionResult.jobId,
      });
    } catch (updateError: unknown) {
      if (updateError && typeof updateError === 'object' && 'code' in updateError && updateError.code === 'P2025') {
        if (transitionResult.jobId) {
          await cleanupOrphanedJob(transitionResult.jobId);
        }
        return NextResponse.json(
          { error: 'Ticket was modified by another request. Please refresh and try again.' },
          { status: 409 }
        );
      }
      throw updateError;
    }
  } catch (error) {
    console.error('Error transitioning ticket:', error);
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (error.message === 'Project not found') return NextResponse.json({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' }, { status: 404 });
      if (error.message === 'Ticket not found') return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
