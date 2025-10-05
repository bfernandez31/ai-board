import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { updateBranchSchema, ProjectIdSchema } from '@/lib/validations/ticket';
import { getProjectById } from '@/lib/db/projects';

const prisma = new PrismaClient();

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

    // Update branch
    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: { branch },
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
  } finally {
    await prisma.$disconnect();
  }
}
