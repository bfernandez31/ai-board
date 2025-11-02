import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireAuth } from '@/lib/db/users';

/**
 * GET /api/ticket/[key]
 * Primary user-facing endpoint for ticket lookup by ticket key
 * This endpoint does not require project ID and resolves access via ticket key
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ key: string }> }
): Promise<NextResponse> {
  try {
    const { key: ticketKey } = await context.params;

    // Validate session
    let userId: string;
    try {
      userId = await requireAuth();
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_ERROR' },
        { status: 401 }
      );
    }

    // Validate ticket key format (KEY-NUM)
    const ticketKeyRegex = /^[A-Z0-9]{3,6}-\d+$/;
    if (!ticketKeyRegex.test(ticketKey)) {
      return NextResponse.json(
        {
          error: 'Invalid ticket key format',
          message: 'Ticket key must be in format KEY-NUM (e.g., ABC-123)',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    // Fetch ticket with project (authorization check included)
    const ticket = await prisma.ticket.findUnique({
      where: { ticketKey },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            clarificationPolicy: true,
            githubOwner: true,
            githubRepo: true,
            userId: true,
            members: {
              where: { userId },
              select: { id: true },
            },
          },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Verify user has access (owner or member)
    const isOwner = ticket.project.userId === userId;
    const isMember = ticket.project.members.length > 0;

    if (!isOwner && !isMember) {
      return NextResponse.json(
        { error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Return ticket with project info (omit userId and members for security)
    return NextResponse.json({
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      ticketKey: ticket.ticketKey,
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
    console.error('Error fetching ticket by key:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
