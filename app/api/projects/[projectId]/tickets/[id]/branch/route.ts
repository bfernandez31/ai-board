import { NextRequest, NextResponse } from 'next/server';
import { updateBranchSchema, ProjectIdSchema } from '@/lib/validations/ticket';
import { getProjectById } from '@/lib/db/projects';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/workflow-auth';
import { resolveTicket } from '@/app/lib/utils/ticket-resolver';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    // Await params in Next.js 15
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdentifier } = params;

    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      return NextResponse.json({ error: 'Invalid project ID', code: 'VALIDATION_ERROR' }, { status: 400 });
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
    const ticket = await resolveTicket(projectId, ticketIdentifier);

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
    const { projectId: projectIdString, id: ticketIdentifier } = params;

    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      return NextResponse.json({ error: 'Invalid project ID', code: 'VALIDATION_ERROR' }, { status: 400 });
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
    const currentTicket = await resolveTicket(projectId, ticketIdentifier);

    if (!currentTicket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Update branch
    const updatedTicket = await prisma.ticket.update({
      where: { id: currentTicket.id },
      data: {
        branch,
        // updatedAt automatically updated by @updatedAt directive
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
