import { NextRequest, NextResponse } from 'next/server';
import { Stage, type Job } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { verifyWorkflowToken } from '@/app/lib/auth/workflow-auth';
import { canRollbackToInbox, canRollbackToPlan } from '@/app/lib/workflows/rollback-validator';
import { handleTicketTransition, cleanupOrphanedJob } from '@/lib/workflows/transition';
import { resolveTicketWithRelations } from '@/app/lib/utils/ticket-resolver';
import { dispatchRollbackResetWorkflow } from '@/app/lib/workflows/dispatch-rollback-reset';

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

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { activeCleanupJobId: true },
    });

    if (project?.activeCleanupJobId) {
      const cleanupJob = await prisma.job.findUnique({
        where: { id: project.activeCleanupJobId },
        select: { status: true, ticket: { select: { ticketKey: true } } },
      });

      if (cleanupJob && ['PENDING', 'RUNNING'].includes(cleanupJob.status)) {
        return NextResponse.json(
          {
            error: 'Project cleanup is in progress. Stage transitions are temporarily disabled.',
            code: 'CLEANUP_IN_PROGRESS',
            details: {
              activeCleanupJobId: project.activeCleanupJobId,
              jobStatus: cleanupJob.status,
              ticketKey: cleanupJob.ticket.ticketKey,
              message: 'You can still update ticket descriptions, documents, and preview deployments. Transitions will be re-enabled when cleanup completes.',
            },
          },
          { status: 423 }
        );
      }

      if (cleanupJob && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(cleanupJob.status)) {
        await prisma.project.update({
          where: { id: projectId },
          data: { activeCleanupJobId: null },
        });
        console.log(`[Transition] Cleared orphaned cleanup lock for project ${projectId}`);
      }
    }

    const isRollbackToInboxAttempt = ticket.stage === 'BUILD' && targetStage === 'INBOX';
    const isRollbackToPlanAttempt = ticket.stage === 'VERIFY' && targetStage === 'PLAN';

    if (isRollbackToInboxAttempt) {
      const ticketWithJobs = ticket as typeof ticket & { jobs: Job[] };
      const mostRecentJob = ticketWithJobs.jobs?.[0] || null;

      const validation = canRollbackToInbox(
        ticket.stage,
        targetStage as Stage,
        ticket.workflowType,
        mostRecentJob
      );

      if (!validation.allowed) {
        return NextResponse.json({ error: validation.reason }, { status: 400 });
      }

      const updatedTicket = await prisma.$transaction(async (tx) => {
        const updated = await tx.ticket.update({
          where: { id: ticket.id },
          data: { stage: 'INBOX', workflowType: 'FULL', branch: null, version: 1 },
        });

        if (mostRecentJob) {
          await tx.job.delete({
            where: { id: mostRecentJob.id },
          });
        }

        return updated;
      });

      return NextResponse.json({
        id: updatedTicket.id,
        stage: updatedTicket.stage,
        workflowType: updatedTicket.workflowType,
        branch: updatedTicket.branch,
        version: updatedTicket.version,
        updatedAt: updatedTicket.updatedAt.toISOString(),
      });
    }

    if (isRollbackToPlanAttempt) {
      const ticketWithJobs = ticket as typeof ticket & { jobs: Job[] };
      const mostRecentJob = ticketWithJobs.jobs?.[0] || null;

      const validation = canRollbackToPlan(
        ticket.stage,
        targetStage as Stage,
        ticket.workflowType,
        mostRecentJob
      );

      if (!validation.allowed) {
        return NextResponse.json({ error: validation.reason }, { status: 400 });
      }

      const ticketWithProject = await prisma.ticket.findUnique({
        where: { id: ticket.id },
        include: { project: true },
      });

      if (!ticketWithProject) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
      }

      const updatedTicket = await prisma.$transaction(async (tx) => {
        const updated = await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            stage: 'PLAN',
            previewUrl: null,
            version: { increment: 1 },
          },
        });

        if (mostRecentJob) {
          await tx.job.delete({
            where: { id: mostRecentJob.id },
          });
        }

        return updated;
      });

      let resetJobId: number | undefined;
      if (updatedTicket.branch) {
        try {
          const dispatchResult = await dispatchRollbackResetWorkflow({
            ticketId: updatedTicket.id,
            ticketKey: ticket.ticketKey,
            projectId: ticket.projectId,
            branch: updatedTicket.branch,
            githubOwner: ticketWithProject.project.githubOwner,
            githubRepo: ticketWithProject.project.githubRepo,
          });
          resetJobId = dispatchResult.jobId;
        } catch (dispatchError) {
          console.error('[Transition] Failed to dispatch rollback-reset workflow:', dispatchError);
        }
      }

      return NextResponse.json({
        id: updatedTicket.id,
        stage: updatedTicket.stage,
        workflowType: updatedTicket.workflowType,
        branch: updatedTicket.branch,
        version: updatedTicket.version,
        previewUrl: updatedTicket.previewUrl,
        updatedAt: updatedTicket.updatedAt.toISOString(),
        resetJobId,
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
