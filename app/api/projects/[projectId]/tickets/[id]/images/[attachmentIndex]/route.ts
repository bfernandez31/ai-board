import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { isTicketAttachmentArray } from '@/app/lib/types/ticket';
import type { TicketAttachment } from '@/app/lib/types/ticket';
import { imageOperationSchema, parseAttachmentIndex } from '@/lib/schemas/ticket-image';

/**
 * DELETE /api/projects/[projectId]/tickets/[id]/images/[attachmentIndex]
 * Remove image from ticket attachments
 *
 * Accepts JSON body with:
 * - version: Ticket version for concurrency control (required)
 *
 * @returns 200: Updated attachments array and new version
 * @returns 400: Validation error (invalid index, version missing)
 * @returns 403: Forbidden - cannot edit images in current stage
 * @returns 404: Ticket or image not found
 * @returns 409: Conflict - version mismatch
 * @returns 500: Internal server error
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string; attachmentIndex: string }> }
) {
  try {
    const {
      projectId: projectIdString,
      id: ticketIdString,
      attachmentIndex: indexString,
    } = await context.params;

    const projectId = parseInt(projectIdString, 10);
    const ticketId = parseInt(ticketIdString, 10);

    if (isNaN(projectId) || isNaN(ticketId)) {
      return NextResponse.json(
        { error: 'Invalid project or ticket ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Parse and validate attachment index
    let attachmentIndex: number;
    try {
      attachmentIndex = parseAttachmentIndex(indexString);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid attachment index', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Verify project ownership
    await verifyProjectOwnership(projectId);

    // Parse request body
    const body = await request.json();
    const validation = imageOperationSchema.safeParse(body);

    if (!validation.success) {
      const errorMessage = validation.error.issues[0]?.message || 'Invalid request';
      return NextResponse.json(
        { error: errorMessage, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { version } = validation.data;

    // Fetch ticket with current attachments and stage
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        projectId,
      },
      select: {
        id: true,
        stage: true,
        version: true,
        attachments: true,
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check permission
    const { canEdit } = await import('@/components/ticket/edit-permission-guard');
    if (!canEdit(ticket.stage, 'images')) {
      return NextResponse.json(
        {
          error: `Cannot edit images in ${ticket.stage} stage. Images can only be edited in SPECIFY and PLAN stages.`,
          code: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    // Verify version (optimistic concurrency control)
    if (ticket.version !== version) {
      return NextResponse.json(
        {
          error: 'Ticket was modified by another user. Please refresh and try again.',
          code: 'CONFLICT',
        },
        { status: 409 }
      );
    }

    // Parse existing attachments
    const existingAttachments = ticket.attachments ?? [];
    if (!isTicketAttachmentArray(existingAttachments)) {
      console.error('Invalid attachments structure for ticket', ticketId, existingAttachments);
      return NextResponse.json(
        { error: 'Invalid attachments data', code: 'DATA_ERROR' },
        { status: 500 }
      );
    }

    // Validate attachment index exists
    if (attachmentIndex >= existingAttachments.length) {
      return NextResponse.json(
        { error: 'Image not found at index', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Remove attachment at index
    const updatedAttachments = existingAttachments.filter((_, idx) => idx !== attachmentIndex);

    // Update ticket in database
    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        attachments: updatedAttachments,
        version: { increment: 1 },
      },
      select: {
        attachments: true,
        version: true,
      },
    });

    return NextResponse.json(
      {
        attachments: updatedTicket.attachments,
        version: updatedTicket.version,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Unauthorized', code: 'AUTH_ERROR' },
          { status: 401 }
        );
      }
      if (error.message === 'Project not found') {
        return NextResponse.json(
          { error: 'Forbidden - project access denied', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }
    }

    console.error('Error deleting image:', error);
    return NextResponse.json(
      { error: 'Failed to delete image', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/projects/[projectId]/tickets/[id]/images/[attachmentIndex]
 * Replace image at index (to be implemented in Phase 6: User Story 4)
 */
export async function PUT() {
  return NextResponse.json(
    { error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' },
    { status: 501 }
  );
}
