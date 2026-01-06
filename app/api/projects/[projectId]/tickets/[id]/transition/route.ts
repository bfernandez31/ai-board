import { NextRequest, NextResponse } from 'next/server';
import { Stage, type Job } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { canRollbackToInbox, canRollbackToPlan } from '@/app/lib/workflows/rollback-validator';
import { handleTicketTransition, cleanupOrphanedJob } from '@/lib/workflows/transition';
import { resolveTicketWithRelations } from '@/app/lib/utils/ticket-resolver';
import { dispatchRollbackResetWorkflow } from '@/app/lib/workflows/dispatch-rollback-reset';
import { canCloseTicket, isCloseTransition, Stage as StageEnum } from '@/lib/stage-transitions';
import { closeTicket } from '@/lib/db/tickets';
import { closePRsOnly } from '@/lib/github/close-prs-only';
import { createGitHubClient } from '@/app/lib/github/client';

// Zod schema for request validation
const TransitionRequestSchema = z.object({
  targetStage: z.enum(['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP', 'CLOSED']),
});

/**
 * POST /api/projects/[projectId]/tickets/[id]/transition
 *
 * Handles ticket stage transitions including rollback from BUILD to INBOX.
 *
 * Rollback (BUILD → INBOX):
 * - Validates job status is FAILED or CANCELLED
 * - Atomically resets: stage, workflowType, branch, version
 * - Deletes the failed/cancelled job
 *
 * Normal Transitions:
 * - Validates sequential stage progression
 * - Updates ticket stage
 *
 * Request Body:
 * {
 *   "targetStage": "INBOX" | "SPECIFY" | "PLAN" | "BUILD" | "VERIFY" | "SHIP"
 * }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    // Await params in Next.js 15
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdentifier } = params;

    // Parse project ID
    const projectId = parseInt(projectIdString, 10);

    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    // Note: Authentication is handled by NextAuth middleware in production
    // For test/dev mode, requests are allowed through

    // Parse and validate request body
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

    // Note: Project access verification is handled by NextAuth middleware
    // Workflow authentication uses Bearer token, not session
    // Authorization is enforced by checking ticket.projectId matches requested projectId

    // Fetch ticket with workflow jobs (supports both numeric ID and ticketKey)
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

    // T048-T051: Check for active cleanup job that locks transitions
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { activeCleanupJobId: true },
    });

    if (project?.activeCleanupJobId) {
      const cleanupJob = await prisma.job.findUnique({
        where: { id: project.activeCleanupJobId },
        select: { status: true, ticket: { select: { ticketKey: true } } },
      });

      // T050: Return 423 Locked if cleanup job is PENDING or RUNNING
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

      // T051: Self-healing logic - clear lock if job is in terminal state
      if (cleanupJob && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(cleanupJob.status)) {
        await prisma.project.update({
          where: { id: projectId },
          data: { activeCleanupJobId: null },
        });
        console.log(`[Transition] Cleared orphaned cleanup lock for project ${projectId}`);
      }
    }

    // Handle VERIFY → CLOSED transition (ticket close)
    if (isCloseTransition(ticket.stage as StageEnum, targetStage as StageEnum)) {
      // Get most recent workflow job
      const ticketWithJobs = ticket as typeof ticket & { jobs: Job[] };
      const mostRecentJob = ticketWithJobs.jobs?.[0] || null;

      // Validate close eligibility
      const validation = canCloseTicket(
        ticket.stage as StageEnum,
        mostRecentJob ? { status: mostRecentJob.status } : null
      );

      if (!validation.allowed) {
        return NextResponse.json({ error: validation.reason }, { status: 400 });
      }

      // Fetch project for GitHub operations
      const ticketProject = await prisma.project.findUnique({
        where: { id: projectId },
        select: { githubOwner: true, githubRepo: true },
      });

      if (!ticketProject) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      // Close the ticket (atomic update)
      const closedTicketResult = await closeTicket(ticket.id, ticket.version);

      // Close associated PRs (best-effort, don't fail the close if PR closure fails)
      let prsClosed = 0;
      if (ticket.branch) {
        try {
          const octokit = createGitHubClient();
          const prResult = await closePRsOnly(
            octokit,
            ticketProject.githubOwner,
            ticketProject.githubRepo,
            ticket.branch,
            `Ticket closed without shipping. Branch preserved for reference.`
          );
          prsClosed = prResult.prsClosed;
        } catch (prError) {
          // Log error but don't fail the close - database state is already correct
          console.error('[Transition] Failed to close PRs:', prError);
        }
      }

      return NextResponse.json({
        id: closedTicketResult.id,
        ticketKey: closedTicketResult.ticketKey,
        stage: closedTicketResult.stage,
        closedAt: closedTicketResult.closedAt.toISOString(),
        version: closedTicketResult.version,
        prsClosed,
      });
    }

    // Detect rollback attempt (BUILD → INBOX)
    const isRollbackToInboxAttempt = ticket.stage === 'BUILD' && targetStage === 'INBOX';

    // Detect rollback attempt (VERIFY → PLAN)
    const isRollbackToPlanAttempt = ticket.stage === 'VERIFY' && targetStage === 'PLAN';

    if (isRollbackToInboxAttempt) {
      // Get most recent workflow job
      const ticketWithJobs = ticket as typeof ticket & { jobs: Job[] };
      const mostRecentJob = ticketWithJobs.jobs?.[0] || null;

      // Validate rollback eligibility (only for quick-impl workflows)
      const validation = canRollbackToInbox(
        ticket.stage,
        targetStage as Stage,
        ticket.workflowType,
        mostRecentJob
      );

      if (!validation.allowed) {
        return NextResponse.json({ error: validation.reason }, { status: 400 });
      }

      // Execute rollback transaction
      const updatedTicket = await prisma.$transaction(async (tx) => {
        // Reset ticket state
        const updated = await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            stage: 'INBOX',
            workflowType: 'FULL',
            branch: null,
            version: 1,
          },
        });

        // Delete failed/cancelled job
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
      // Get most recent workflow job
      const ticketWithJobs = ticket as typeof ticket & { jobs: Job[] };
      const mostRecentJob = ticketWithJobs.jobs?.[0] || null;

      // Validate rollback eligibility (only for FULL workflows)
      const validation = canRollbackToPlan(
        ticket.stage,
        targetStage as Stage,
        ticket.workflowType,
        mostRecentJob
      );

      if (!validation.allowed) {
        return NextResponse.json({ error: validation.reason }, { status: 400 });
      }

      // Fetch project relation for workflow dispatch
      const ticketWithProject = await prisma.ticket.findUnique({
        where: { id: ticket.id },
        include: { project: true },
      });

      if (!ticketWithProject) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
      }

      // Execute rollback transaction
      const updatedTicket = await prisma.$transaction(async (tx) => {
        // Reset ticket state - keep branch and workflowType, clear previewUrl, increment version
        const updated = await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            stage: 'PLAN',
            previewUrl: null,
            version: { increment: 1 },
          },
        });

        // Delete the job (COMPLETED/FAILED/CANCELLED)
        if (mostRecentJob) {
          await tx.job.delete({
            where: { id: mostRecentJob.id },
          });
        }

        return updated;
      });

      // Dispatch rollback-reset workflow to reset git branch
      // This runs after the transaction succeeds to ensure data consistency
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
          // Log error but don't fail the rollback - database state is already correct
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

    // Handle normal transitions
    // Fetch ticket with project relation for workflow dispatch
    const ticketWithProject = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      include: { project: true },
    });

    if (!ticketWithProject) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Detect quick-impl mode (INBOX → BUILD)
    const isQuickImpl = ticket.stage === 'INBOX' && targetStage === 'BUILD';

    // Execute transition workflow (creates job, dispatches GitHub workflow)
    // For quick-impl: also updates workflowType to QUICK atomically with job creation
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

    // For quick-impl, fetch the updated ticket to get the new version
    // (handleTicketTransition increments version when setting workflowType=QUICK)
    let currentVersion = ticket.version;
    if (isQuickImpl) {
      const refreshedTicket = await prisma.ticket.findUnique({
        where: { id: ticket.id },
        select: { version: true },
      });
      currentVersion = refreshedTicket?.version || ticket.version;
    }

    // Update ticket stage (optimistic concurrency control)
    // Note: Branch is NOT set here - it will be created by GitHub workflow
    // and updated via PATCH /api/projects/:projectId/tickets/:id/branch
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
      // Handle version conflict
      if (updateError && typeof updateError === 'object' && 'code' in updateError && updateError.code === 'P2025') {
        // Clean up orphaned job on version conflict
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

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Project not found') {
        return NextResponse.json(
          { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
          { status: 404 }
        );
      }
      if (error.message === 'Ticket not found') {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
