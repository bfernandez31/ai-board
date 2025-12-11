import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/client';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { createTicket } from '@/lib/db/tickets';
import { createDuplicateTitle } from '@/lib/utils/ticket-title';
import { ProjectIdSchema } from '@/lib/validations/ticket';
import type { TicketAttachment } from '@/app/lib/types/ticket';

/**
 * POST /api/projects/[projectId]/tickets/[id]/duplicate
 * Creates a duplicate of an existing ticket in the INBOX stage
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
        { error: 'Invalid project ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Validate ticketId format
    const ticketId = parseInt(ticketIdString, 10);
    if (isNaN(ticketId) || ticketId <= 0) {
      return NextResponse.json(
        { error: 'Invalid ticket ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const projectId = parseInt(projectIdString, 10);

    // Verify project access (owner OR member)
    await verifyProjectAccess(projectId);

    // Fetch source ticket
    const sourceTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        title: true,
        description: true,
        clarificationPolicy: true,
        attachments: true,
        projectId: true,
      },
    });

    // Check ticket exists
    if (!sourceTicket) {
      return NextResponse.json(
        { error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check ticket belongs to the specified project
    if (sourceTicket.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Create duplicate title with "Copy of " prefix
    const duplicateTitle = createDuplicateTitle(sourceTicket.title);

    // Copy attachments (reference same Cloudinary URLs)
    const attachments = sourceTicket.attachments
      ? (sourceTicket.attachments as unknown as TicketAttachment[])
      : undefined;

    // Create duplicate ticket in INBOX
    const newTicket = await createTicket(projectId, {
      title: duplicateTitle,
      description: sourceTicket.description,
      clarificationPolicy: sourceTicket.clarificationPolicy,
      attachments,
    });

    // Revalidate the project board page
    revalidatePath(`/projects/${projectId}/board`);

    // Return created ticket with 201 status
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
        autoMode: newTicket.autoMode,
        workflowType: newTicket.workflowType,
        clarificationPolicy: newTicket.clarificationPolicy,
        attachments: newTicket.attachments,
        createdAt: newTicket.createdAt.toISOString(),
        updatedAt: newTicket.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    // Handle authentication/authorization errors
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

    console.error('Error duplicating ticket:', error);
    return NextResponse.json(
      { error: 'Failed to duplicate ticket', code: 'DATABASE_ERROR' },
      { status: 500 }
    );
  }
}
