import { NextRequest, NextResponse } from 'next/server';
import { Stage as PrismaStage } from '@prisma/client';
import { z } from 'zod';
import { Stage, isValidTransition } from '@/lib/stage-validation';
import { patchTicketSchema, ProjectIdSchema } from '@/lib/validations/ticket';
import { getProjectById } from '@/lib/db/projects';
import { handleTicketTransition, cleanupOrphanedJob } from '@/lib/workflows/transition';
import { prisma } from '@/lib/db/client';

/**
 * Zod schema for validating stage update requests
 */
const UpdateStageSchema = z.object({
  stage: z.nativeEnum(Stage),
  version: z.number().int().positive(),
});

/**
 * GET /api/projects/[projectId]/tickets/[id]
 * Get a single ticket by ID with project validation
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdString } = params;

    // Validate projectId format
    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      return NextResponse.json(
        { error: 'Invalid project ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const projectId = parseInt(projectIdString, 10);
    const ticketId = parseInt(ticketIdString, 10);

    if (isNaN(ticketId)) {
      return NextResponse.json({ error: 'Invalid ticket ID' }, { status: 400 });
    }

    // Check if project exists
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Fetch ticket with project validation
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        projectId: projectId,
      },
    });

    if (!ticket) {
      // Check if ticket exists in different project
      const ticketExists = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true, projectId: true },
      });

      if (!ticketExists) {
        return NextResponse.json(
          { error: 'Ticket not found' },
          { status: 404 }
        );
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    return NextResponse.json({
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      stage: ticket.stage,
      version: ticket.version,
      projectId: ticket.projectId,
      branch: ticket.branch,
      autoMode: ticket.autoMode,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/[projectId]/tickets/[id]
 * Update ticket stage OR title/description with project validation and optimistic concurrency control
 *
 * Request Body (Stage Update):
 * {
 *   "stage": "PLAN",
 *   "version": 1
 * }
 *
 * Request Body (Inline Edit):
 * {
 *   "title"?: "Updated Title",
 *   "description"?: "Updated Description",
 *   "version": 1
 * }
 *
 * Success Response (200):
 * {
 *   "id": 123,
 *   "title": "...",
 *   "description": "...",
 *   "stage": "PLAN",
 *   "version": 2,
 *   "createdAt": "2025-10-01T12:34:56.789Z",
 *   "updatedAt": "2025-10-01T12:34:56.789Z"
 * }
 *
 * Error Responses:
 * - 400: Invalid request or validation error
 * - 403: Ticket belongs to different project (Forbidden)
 * - 404: Project or ticket not found
 * - 409: Version conflict (ticket modified by another user)
 * - 500: Internal server error
 */
export async function PATCH(
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

    // Check if project exists
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        {
          error: 'Project not found',
          code: 'PROJECT_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Determine operation type based on request body
    const isStageUpdate =
      'stage' in body &&
      !(
        'title' in body ||
        'description' in body ||
        'branch' in body ||
        'autoMode' in body
      );
    const isInlineEdit =
      'title' in body ||
      'description' in body ||
      'branch' in body ||
      'autoMode' in body;

    // Handle inline edit (title/description update)
    if (isInlineEdit) {
      const parseResult = patchTicketSchema.safeParse(body);

      if (!parseResult.success) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            issues: parseResult.error.issues,
          },
          { status: 400 }
        );
      }

      const {
        title,
        description,
        stage,
        branch,
        autoMode,
        version: requestVersion,
      } = parseResult.data;

      // Check if ticket exists with project validation (load project relation for workflow)
      const currentTicket = await prisma.ticket.findFirst({
        where: {
          id: ticketId,
          projectId: projectId,
        },
        include: {
          project: true,
        },
      });

      if (!currentTicket) {
        // Distinguish between 404 (ticket doesn't exist) and 403 (wrong project)
        const ticketExists = await prisma.ticket.findUnique({
          where: { id: ticketId },
          select: { id: true, projectId: true },
        });

        if (!ticketExists) {
          return NextResponse.json(
            { error: 'Ticket not found' },
            { status: 404 }
          );
        } else {
          // Ticket exists but belongs to different project
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }

      // Check for version conflict
      if (currentTicket.version !== requestVersion) {
        return NextResponse.json(
          {
            error: 'Conflict: Ticket was modified by another user',
            currentVersion: currentTicket.version,
          },
          { status: 409 }
        );
      }

      // Handle stage transition with GitHub workflow dispatch
      let jobId: number | undefined;
      let workflowBranchName: string | undefined;

      if (stage !== undefined && stage !== currentTicket.stage) {
        // Stage is changing - trigger GitHub workflow
        const transitionResult = await handleTicketTransition(
          currentTicket,
          stage as PrismaStage
        );

        if (!transitionResult.success) {
          return NextResponse.json(
            {
              error: transitionResult.error,
              code: transitionResult.errorCode,
            },
            { status: transitionResult.errorCode === 'INVALID_TRANSITION' ? 400 : 500 }
          );
        }

        jobId = transitionResult.jobId;
        workflowBranchName = transitionResult.branchName;
      }

      // Update ticket with version check
      try {
        const updatedTicket = await prisma.ticket.update({
          where: {
            id: ticketId,
            version: requestVersion,
          },
          data: {
            ...(title !== undefined && { title: title.trim() }),
            ...(description !== undefined && {
              description: description.trim(),
            }),
            ...(stage !== undefined && { stage }),
            ...(branch !== undefined && { branch }),
            ...(workflowBranchName && { branch: workflowBranchName }),
            ...(autoMode !== undefined && { autoMode }),
            version: { increment: 1 },
          },
        });

        return NextResponse.json(
          {
            id: updatedTicket.id,
            title: updatedTicket.title,
            description: updatedTicket.description,
            stage: updatedTicket.stage,
            version: updatedTicket.version,
            projectId: updatedTicket.projectId,
            branch: updatedTicket.branch,
            autoMode: updatedTicket.autoMode,
            createdAt: updatedTicket.createdAt.toISOString(),
            updatedAt: updatedTicket.updatedAt.toISOString(),
            ...(jobId !== undefined && { jobId }),
          },
          { status: 200 }
        );
      } catch (updateError) {
        // Handle version mismatch (P2025 error)
        if (updateError instanceof Error && 'code' in updateError) {
          const prismaError = updateError as { code: string };
          if (prismaError.code === 'P2025') {
            // Clean up orphaned job if it was created
            if (jobId !== undefined) {
              await cleanupOrphanedJob(jobId);
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
    }

    // Handle stage update
    if (isStageUpdate) {
      const parseResult = UpdateStageSchema.safeParse(body);

      if (!parseResult.success) {
        return NextResponse.json(
          {
            error: 'Validation error',
            message: 'Invalid request body',
            details: parseResult.error.flatten(),
          },
          { status: 400 }
        );
      }

      const { stage: newStage, version: requestVersion } = parseResult.data;

      // Fetch current ticket with project validation (load project relation for workflow)
      const currentTicket = await prisma.ticket.findFirst({
        where: {
          id: ticketId,
          projectId: projectId,
        },
        include: {
          project: true,
        },
      });

      if (!currentTicket) {
        // Distinguish between 404 and 403
        const ticketExists = await prisma.ticket.findUnique({
          where: { id: ticketId },
          select: { id: true, projectId: true },
        });

        if (!ticketExists) {
          return NextResponse.json(
            { error: 'Ticket not found' },
            { status: 404 }
          );
        } else {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }

      // Check for version conflict (optimistic concurrency control)
      if (currentTicket.version !== requestVersion) {
        return NextResponse.json(
          {
            error: 'Ticket modified by another user',
            currentStage: currentTicket.stage,
            currentVersion: currentTicket.version,
          },
          { status: 409 }
        );
      }

      // Validate stage transition and trigger GitHub workflow
      const currentStage = currentTicket.stage as Stage;
      if (!isValidTransition(currentStage, newStage)) {
        return NextResponse.json(
          {
            error: 'Invalid stage transition',
            message: `Cannot transition from ${currentStage} to ${newStage}. Tickets must progress sequentially through stages.`,
          },
          { status: 400 }
        );
      }

      // Trigger GitHub workflow for stage transition
      const transitionResult = await handleTicketTransition(
        currentTicket,
        newStage as PrismaStage
      );

      if (!transitionResult.success) {
        return NextResponse.json(
          {
            error: transitionResult.error,
            code: transitionResult.errorCode,
          },
          { status: transitionResult.errorCode === 'INVALID_TRANSITION' ? 400 : 500 }
        );
      }

      // Update ticket atomically with version increment
      try {
        const updatedTicket = await prisma.ticket.update({
          where: {
            id: ticketId,
            version: requestVersion,
          },
          data: {
            stage: newStage,
            ...(transitionResult.branchName && { branch: transitionResult.branchName }),
            version: { increment: 1 },
          },
        });

        // Return successful response with job info if workflow was triggered
        return NextResponse.json(
          {
            id: updatedTicket.id,
            stage: updatedTicket.stage,
            version: updatedTicket.version,
            branch: updatedTicket.branch,
            updatedAt: updatedTicket.updatedAt.toISOString(),
            ...(transitionResult.jobId !== undefined && { jobId: transitionResult.jobId }),
          },
          { status: 200 }
        );
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
                error: 'Ticket modified by another user',
                currentVersion: latestTicket?.version || 0,
              },
              { status: 409 }
            );
          }
        }
        throw updateError;
      }
    }

    // If neither stage nor inline edit, return error
    return NextResponse.json(
      {
        error: 'Invalid request',
        message: 'Must provide either stage or title/description to update',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating ticket:', error);

    // Handle Prisma errors
    if (error instanceof Error && 'code' in error) {
      const prismaError = error as { code: string; meta?: { cause?: string } };

      // P2025: Record not found (version mismatch in where clause)
      if (prismaError.code === 'P2025') {
        return NextResponse.json(
          {
            error: 'Ticket modified by another user',
            message:
              'The ticket was updated by someone else. Please refresh and try again.',
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
