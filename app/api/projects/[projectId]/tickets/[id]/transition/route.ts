import { NextRequest, NextResponse } from 'next/server';
import { Stage } from '@prisma/client';
import { TransitionRequestSchema, ProjectIdSchema } from '@/lib/validations/ticket';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { handleTicketTransition, cleanupOrphanedJob } from '@/lib/workflows/transition';
import { prisma } from '@/lib/db/client';

/**
 * POST /api/projects/[projectId]/tickets/[id]/transition
 *
 * Transitions a ticket to the next sequential stage:
 * - Validates stage transition is sequential (via isValidTransition)
 * - For automated stages (SPECIFY, PLAN, BUILD):
 *   - Creates a Job record with PENDING status
 *   - Dispatches GitHub Actions workflow via Octokit
 *   - Updates ticket stage and version atomically
 *   - Note: Branch is NOT set here - it's created by the GitHub workflow
 *     and updated via PATCH /branch when the job completes
 * - For manual stages (VERIFY, SHIP):
 *   - Updates ticket stage only (no job, no workflow dispatch)
 *
 * Request Body:
 * {
 *   "targetStage": "SPECIFY" | "PLAN" | "BUILD" | "VERIFY" | "SHIP"
 * }
 *
 * Success Response (200) - Automated stages:
 * {
 *   "success": true,
 *   "jobId": 123,
 *   "message": "Workflow dispatched successfully"
 * }
 *
 * Success Response (200) - Manual stages:
 * {
 *   "success": true,
 *   "message": "Stage updated (no workflow for VERIFY/SHIP)"
 * }
 *
 * Error Responses:
 * - 400: Invalid request, validation error, or invalid transition
 * - 403: Ticket belongs to different project (Forbidden)
 * - 404: Project or ticket not found
 * - 409: Version conflict (optimistic concurrency)
 * - 500: GitHub API error or internal server error
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    // Await params in Next.js 15
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdString } = params;

    // Validate projectId format
    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid project ID',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    const projectId = parseInt(projectIdString, 10);

    // Validate ticket ID
    const ticketId = parseInt(ticketIdString, 10);
    if (isNaN(ticketId)) {
      return NextResponse.json(
        { error: 'Invalid ticket ID', message: 'Ticket ID must be a number' },
        { status: 400 }
      );
    }

    // Verify project ownership (throws if unauthorized or not found)
    await verifyProjectOwnership(projectId);

    // Parse and validate request body
    const body = await request.json();
    const parseResult = TransitionRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          issues: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { targetStage } = parseResult.data;

    // Fetch current ticket with project relation
    // Note: We've already verified project ownership above, so we can safely fetch
    const currentTicket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        projectId: projectId,
      },
      include: {
        project: {
          select: {
            id: true,
            githubOwner: true,
            githubRepo: true,
          },
        },
      },
    });

    if (!currentTicket) {
      // Distinguish between 404 (ticket doesn't exist) and 403 (wrong project)
      const ticketExists = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true, projectId: true },
      });

      if (!ticketExists) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
      } else {
        // Ticket exists but belongs to different project
        return NextResponse.json(
          { error: 'Forbidden', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }
    }

    // Handle transition with GitHub workflow dispatch using shared function
    const transitionResult = await handleTicketTransition(
      currentTicket,
      targetStage as Stage
    );

    if (!transitionResult.success) {
      return NextResponse.json(
        {
          error: transitionResult.errorCode === 'INVALID_TRANSITION'
            ? 'Invalid stage transition'
            : transitionResult.error,
          message: transitionResult.error,
          code: transitionResult.errorCode,
        },
        { status: transitionResult.errorCode === 'INVALID_TRANSITION' ? 400 : 500 }
      );
    }

    // Update ticket atomically with version increment
    // Note: Branch is NOT set here - it's created by the GitHub workflow
    // and updated via PATCH /branch when the workflow completes
    try {
      await prisma.ticket.update({
        where: {
          id: ticketId,
          version: currentTicket.version,
        },
        data: {
          stage: targetStage as Stage,
          version: { increment: 1 },
        },
      });
    } catch (updateError) {
      // Handle version mismatch (P2025 error)
      if (updateError instanceof Error && 'code' in updateError) {
        const prismaError = updateError as { code: string };
        if (prismaError.code === 'P2025') {
          // Clean up orphaned job if it was created
          if (transitionResult.jobId !== undefined) {
            await cleanupOrphanedJob(transitionResult.jobId);
          }

          // Re-fetch to get current version
          const latestTicket = await prisma.ticket.findUnique({
            where: { id: ticketId },
          });
          return NextResponse.json(
            {
              error: 'Conflict: Ticket was modified by another user',
              currentVersion: latestTicket?.version || 0,
            },
            { status: 409 }
          );
        }
      }
      throw updateError;
    }

    // Return success response
    return NextResponse.json(
      {
        success: true,
        ...(transitionResult.jobId !== undefined && { jobId: transitionResult.jobId }),
        message: transitionResult.jobId
          ? 'Workflow dispatched successfully'
          : 'Stage updated (no workflow for VERIFY/SHIP)',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error transitioning ticket:', error);

    // Handle authentication errors
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Unauthorized', code: 'AUTH_ERROR' },
          { status: 401 }
        );
      }
      if (error.message === 'Project not found') {
        return NextResponse.json(
          { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
