import { NextRequest, NextResponse } from 'next/server';
import { Stage } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { canRollbackToInbox } from '@/app/lib/workflows/rollback-validator';
import { handleTicketTransition, cleanupOrphanedJob } from '@/lib/workflows/transition';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';

// Zod schema for request validation
const TransitionRequestSchema = z.object({
  targetStage: z.enum(['INBOX', 'SPECIFY', 'PLAN', 'BUILD', 'VERIFY', 'SHIP']),
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
    const { projectId: projectIdString, id: ticketIdString } = params;

    // Parse IDs
    const projectId = parseInt(projectIdString, 10);
    const ticketId = parseInt(ticketIdString, 10);

    if (isNaN(projectId) || isNaN(ticketId)) {
      return NextResponse.json(
        { error: 'Invalid project ID or ticket ID' },
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

    // Verify project access (owner OR member)
    await verifyProjectAccess(projectId);

    // Fetch ticket with workflow jobs
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        projectId,
      },
      include: {
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
      },
    });

    if (!ticket) {
      // Check if ticket exists in a different project
      const ticketExists = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true, projectId: true },
      });

      if (!ticketExists) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Detect rollback attempt (BUILD → INBOX)
    const isRollbackAttempt = ticket.stage === 'BUILD' && targetStage === 'INBOX';

    if (isRollbackAttempt) {
      // Get most recent workflow job
      const mostRecentJob = ticket.jobs[0] || null;

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
          where: { id: ticketId },
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

    // Handle normal transitions
    // Fetch ticket with project relation for workflow dispatch
    const ticketWithProject = await prisma.ticket.findUnique({
      where: { id: ticketId },
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
        where: { id: ticketId },
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
          id: ticketId,
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
