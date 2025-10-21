import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { isTicketAttachmentArray } from '@/app/lib/types/ticket';
import type { TicketAttachment } from '@/app/lib/types/ticket';

/**
 * GET /api/projects/[projectId]/tickets/[id]/images
 * Returns image metadata for a ticket (lazy loading optimization)
 *
 * Fetches ticket attachments from database without downloading actual image files.
 * Used by frontend to display image count badge and metadata before user expands gallery.
 *
 * @returns 200: Array of ticket attachments with index field
 * @returns 403: Forbidden - project access denied
 * @returns 404: Ticket not found
 * @returns 500: Internal server error
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
) {
  try {
    const { projectId: projectIdString, id: ticketIdString } = await context.params;

    const projectId = parseInt(projectIdString, 10);
    const ticketId = parseInt(ticketIdString, 10);

    if (isNaN(projectId) || isNaN(ticketId)) {
      return NextResponse.json(
        { error: 'Invalid project or ticket ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Verify project ownership (throws if unauthorized or not found)
    await verifyProjectOwnership(projectId);

    // Fetch ticket with attachments
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        projectId,
      },
      select: {
        attachments: true,
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Parse attachments from JSON field
    const attachments = ticket.attachments ?? [];

    // Validate attachments structure
    if (!isTicketAttachmentArray(attachments)) {
      console.error('Invalid attachments structure for ticket', ticketId, attachments);
      return NextResponse.json(
        { error: 'Invalid attachments data', code: 'DATA_ERROR' },
        { status: 500 }
      );
    }

    // Add index field to each attachment for frontend reference
    const imagesWithIndex = attachments.map((attachment, index) => ({
      index,
      ...attachment,
    }));

    return NextResponse.json({ images: imagesWithIndex }, { status: 200 });
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

    console.error('Error fetching ticket images:', error);
    return NextResponse.json(
      { error: 'Failed to fetch images', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[projectId]/tickets/[id]/images
 * Upload new image to ticket (to be implemented in Phase 4: User Story 2)
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Not implemented yet', code: 'NOT_IMPLEMENTED' },
    { status: 501 }
  );
}
