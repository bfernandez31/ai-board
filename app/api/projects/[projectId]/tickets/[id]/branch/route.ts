import { NextRequest, NextResponse } from 'next/server';
import { updateBranchSchema, ProjectIdSchema } from '@/lib/validations/ticket';
import { getProjectById } from '@/lib/db/projects';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/workflow-auth';

/**
 * GET /api/projects/[projectId]/tickets/[id]/branch
 * Returns 404 for non-existent tickets (common error case handling)
 *
 * Error Responses:
 * - 404: Project or ticket not found
 * - 500: Internal server error
 */
export async function GET(
  _request: NextRequest,
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

    // Support both numeric ID and ticketKey (e.g., ABC-123)
    const ticketKeyRegex = /^[A-Z0-9]{3,6}-\d+$/;
    let ticket;

    if (ticketKeyRegex.test(ticketIdString)) {
      // Query by ticketKey
      ticket = await prisma.ticket.findFirst({
        where: {
          ticketKey: ticketIdString,
          projectId: projectId,
        },
      });
    } else {
      // Query by numeric ID (backward compatibility)
      const ticketId = parseInt(ticketIdString, 10);
      if (isNaN(ticketId)) {
        return NextResponse.json(
          { error: 'Invalid ticket identifier', message: 'Ticket identifier must be a number or ticket key (e.g., ABC-123)' },
          { status: 400 }
        );
      }
      ticket = await prisma.ticket.findFirst({
        where: {
          id: ticketId,
          projectId: projectId,
        },
      });
    }

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Return ticket branch info
    return NextResponse.json(
      {
        id: ticket.id,
        branch: ticket.branch,
        updatedAt: ticket.updatedAt.toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error getting ticket branch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/[projectId]/tickets/[id]/branch
 * Specialized endpoint for updating ticket branch name
 *
 * Request Body:
 * {
 *   "branch": "014-add-github-branch" | null
 * }
 *
 * Success Response (200):
 * {
 *   "id": 123,
 *   "branch": "014-add-github-branch",
 *   "updatedAt": "2025-10-04T12:05:00Z"
 * }
 *
 * Error Responses:
 * - 400: Invalid request or validation error (branch too long)
 * - 403: Ticket belongs to different project (Forbidden)
 * - 404: Project or ticket not found
 * - 500: Internal server error
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    // Validate workflow authentication
    const authResult = validateWorkflowAuth(request);
    if (!authResult.isValid) {
      console.error('[Branch Update] Authentication failed:', authResult.error);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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

    // Parse and validate request body
    const body = await request.json();
    const parseResult = updateBranchSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const { branch } = parseResult.data;

    // Support both numeric ID and ticketKey (e.g., ABC-123)
    const ticketKeyRegex = /^[A-Z0-9]{3,6}-\d+$/;
    let currentTicket;
    let ticketId: number | undefined;

    if (ticketKeyRegex.test(ticketIdString)) {
      // Query by ticketKey
      currentTicket = await prisma.ticket.findFirst({
        where: {
          ticketKey: ticketIdString,
          projectId: projectId,
        },
      });
      ticketId = currentTicket?.id;
    } else {
      // Query by numeric ID (backward compatibility)
      ticketId = parseInt(ticketIdString, 10);
      if (isNaN(ticketId)) {
        return NextResponse.json(
          { error: 'Invalid ticket identifier', message: 'Ticket identifier must be a number or ticket key (e.g., ABC-123)' },
          { status: 400 }
        );
      }
      currentTicket = await prisma.ticket.findFirst({
        where: {
          id: ticketId,
          projectId: projectId,
        },
      });
    }

    if (!currentTicket || !ticketId) {
      // Distinguish between 404 (ticket doesn't exist) and 403 (wrong project)
      let ticketExists;

      if (ticketKeyRegex.test(ticketIdString)) {
        ticketExists = await prisma.ticket.findUnique({
          where: { ticketKey: ticketIdString },
          select: { id: true, projectId: true },
        });
      } else if (ticketId) {
        ticketExists = await prisma.ticket.findUnique({
          where: { id: ticketId },
          select: { id: true, projectId: true },
        });
      }

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

    // Update branch
    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        branch,
        updatedAt: new Date(), // Explicitly update timestamp
      },
      select: {
        id: true,
        branch: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        id: updatedTicket.id,
        branch: updatedTicket.branch,
        updatedAt: updatedTicket.updatedAt.toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating ticket branch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
