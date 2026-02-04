import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { fullCloneTicket } from '@/lib/db/tickets';
import { ProjectIdSchema } from '@/lib/validations/ticket';
import { z } from 'zod';

// Schema for validating ticket ID parameter
const TicketIdSchema = z.string().regex(/^\d+$/, 'Ticket ID must be a positive integer');

/**
 * POST /api/projects/[projectId]/tickets/[id]/clone
 * Full clone of a ticket with all jobs and a new Git branch
 * Only available for tickets in SPECIFY, PLAN, BUILD, or VERIFY stages
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
) {
  try {
    const { projectId: projectIdString, id: ticketIdString } = await context.params;

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

    // Validate ticketId format
    const ticketIdResult = TicketIdSchema.safeParse(ticketIdString);
    if (!ticketIdResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid ticket ID',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    const projectId = parseInt(projectIdString, 10);
    const ticketId = parseInt(ticketIdString, 10);

    // Verify project access (owner OR member)
    await verifyProjectAccess(projectId);

    // Full clone the ticket (includes stage validation, job duplication, and branch creation)
    const newTicket = await fullCloneTicket(projectId, ticketId);

    // Revalidate the project board page
    revalidatePath(`/projects/${projectId}/board`);

    // Return the new ticket with 201 Created status
    return NextResponse.json(
      {
        id: newTicket.id,
        ticketNumber: newTicket.ticketNumber,
        ticketKey: newTicket.ticketKey,
        title: newTicket.title,
        description: newTicket.description,
        stage: newTicket.stage,
        version: newTicket.version,
        projectId: newTicket.projectId,
        branch: newTicket.branch,
        previewUrl: newTicket.previewUrl,
        autoMode: newTicket.autoMode,
        workflowType: newTicket.workflowType,
        attachments: newTicket.attachments,
        clarificationPolicy: newTicket.clarificationPolicy,
        createdAt: newTicket.createdAt.toISOString(),
        updatedAt: newTicket.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    // Handle specific errors
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
      if (error.message === 'Ticket not found') {
        return NextResponse.json(
          { error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
          { status: 404 }
        );
      }
      if (error.message === 'Full clone is only available for tickets in SPECIFY, PLAN, BUILD, or VERIFY stages') {
        return NextResponse.json(
          { error: error.message, code: 'INVALID_STAGE' },
          { status: 400 }
        );
      }
      if (error.message === 'Source ticket has no branch to clone') {
        return NextResponse.json(
          { error: error.message, code: 'NO_BRANCH' },
          { status: 400 }
        );
      }
      if (error.message.startsWith('Failed to create branch')) {
        return NextResponse.json(
          { error: error.message, code: 'GITHUB_ERROR' },
          { status: 500 }
        );
      }
    }

    console.error('Error cloning ticket:', error);
    return NextResponse.json(
      {
        error: 'Failed to clone ticket',
        code: 'DATABASE_ERROR',
      },
      { status: 500 }
    );
  }
}
