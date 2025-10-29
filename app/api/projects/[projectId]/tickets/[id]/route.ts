import { NextRequest, NextResponse } from 'next/server';
import { patchTicketSchema, ProjectIdSchema } from '@/lib/validations/ticket';
import { verifyTicketAccess, verifyProjectAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { canEditDescriptionAndPolicy } from '@/lib/utils/field-edit-permissions';

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

    // First verify project access (this will throw if project not found or no access)
    await verifyProjectAccess(projectId);

    // Then verify ticket access (owner OR member via project)
    const ticketAuth = await verifyTicketAccess(ticketId);

    // Validate ticket belongs to correct project
    if (ticketAuth.projectId !== projectId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch ticket with project validation (include project for clarificationPolicy)
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        projectId: projectId,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            clarificationPolicy: true,
            githubOwner: true,
            githubRepo: true,
          },
        },
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
      clarificationPolicy: ticket.clarificationPolicy,
      workflowType: ticket.workflowType,
      attachments: ticket.attachments,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      project: {
        id: ticket.project.id,
        name: ticket.project.name,
        clarificationPolicy: ticket.project.clarificationPolicy,
        githubOwner: ticket.project.githubOwner,
        githubRepo: ticket.project.githubRepo,
      },
    });
  } catch (error) {
    console.error('Error fetching ticket:', error);

    // Handle authentication errors
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Unauthorized', code: 'AUTH_ERROR' },
          { status: 401 }
        );
      }
      if (error.message === 'Project not found' || error.message === 'Ticket not found') {
        return NextResponse.json(
          { error: 'Ticket not found' },
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

    // First verify project access (this will throw if project not found or no access)
    await verifyProjectAccess(projectId);

    // Then verify ticket access (owner OR member via project)
    const ticketAuth = await verifyTicketAccess(ticketId);

    // Validate ticket belongs to correct project
    if (ticketAuth.projectId !== projectId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
      'autoMode' in body ||
      'clarificationPolicy' in body;

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
        branch,
        autoMode,
        clarificationPolicy,
        version: requestVersion,
      } = parseResult.data;

      // Check if ticket exists with project validation
      const currentTicket = await prisma.ticket.findFirst({
        where: {
          id: ticketId,
          projectId: projectId,
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

      // Check stage-based editing restrictions
      // Description and clarificationPolicy can only be edited in INBOX stage
      if (
        (description !== undefined || clarificationPolicy !== undefined) &&
        !canEditDescriptionAndPolicy(currentTicket.stage)
      ) {
        return NextResponse.json(
          {
            error:
              'Description and clarification policy can only be updated in INBOX stage',
            code: 'INVALID_STAGE_FOR_EDIT',
          },
          { status: 400 }
        );
      }

      // Update ticket with version check (inline edit only - no stage transitions)
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
            ...(branch !== undefined && { branch }),
            ...(autoMode !== undefined && { autoMode }),
            ...(clarificationPolicy !== undefined && { clarificationPolicy }),
            version: { increment: 1 },
            updatedAt: new Date(), // Explicitly update timestamp
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
            clarificationPolicy: updatedTicket.clarificationPolicy,
            workflowType: updatedTicket.workflowType,
            createdAt: updatedTicket.createdAt.toISOString(),
            updatedAt: updatedTicket.updatedAt.toISOString(),
          },
          { status: 200 }
        );
      } catch (updateError) {
        // Handle version mismatch (P2025 error)
        if (updateError instanceof Error && 'code' in updateError) {
          const prismaError = updateError as { code: string };
          if (prismaError.code === 'P2025') {
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

    // Stage transitions should use POST /transition endpoint instead
    if (isStageUpdate) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          message: 'Stage transitions must use POST /api/projects/:projectId/tickets/:id/transition endpoint',
        },
        { status: 400 }
      );
    }

    // If no fields to update, return error
    return NextResponse.json(
      {
        error: 'Invalid request',
        message: 'Must provide fields to update (title, description, branch, autoMode, or clarificationPolicy)',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating ticket:', error);

    // Handle authentication errors
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Unauthorized', code: 'AUTH_ERROR' },
          { status: 401 }
        );
      }
      if (error.message === 'Project not found' || error.message === 'Ticket not found') {
        return NextResponse.json(
          { error: 'Ticket not found' },
          { status: 404 }
        );
      }
    }

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
