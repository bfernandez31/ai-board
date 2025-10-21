import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
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
        attachments: updatedAttachments as unknown as Prisma.InputJsonValue,
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
 * Replace image at index with new image
 *
 * Accepts multipart/form-data with:
 * - file: New image file (required)
 * - version: Ticket version for concurrency control (required)
 *
 * @returns 200: Updated attachments array and new version
 * @returns 400: Validation error (file type, size, version missing, invalid index)
 * @returns 403: Forbidden - cannot edit images in current stage
 * @returns 404: Ticket or image not found
 * @returns 409: Conflict - version mismatch
 * @returns 500: Internal server error
 */
export async function PUT(
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

    // Check content type
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Content-Type must be multipart/form-data', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const versionString = formData.get('version') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Missing required field: file', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    if (!versionString) {
      return NextResponse.json(
        { error: 'Missing required field: version', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const version = parseInt(versionString, 10);
    if (isNaN(version) || version < 1) {
      return NextResponse.json(
        { error: 'Invalid version number', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Validate file using Zod schema
    const { imageFileSchema } = await import('@/lib/schemas/ticket-image');
    const fileValidation = imageFileSchema.safeParse({ file, version });
    if (!fileValidation.success) {
      const errorMessage = fileValidation.error.issues[0]?.message || 'Invalid file';
      return NextResponse.json(
        { error: errorMessage, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

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
        project: {
          select: {
            githubOwner: true,
            githubRepo: true,
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

    // Convert File to Buffer for GitHub upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to GitHub
    const { createGitHubClient } = await import('@/app/lib/github/client');
    const { commitImageToRepo } = await import('@/app/lib/github/operations');

    if (!ticket.project.githubOwner || !ticket.project.githubRepo) {
      return NextResponse.json(
        { error: 'GitHub repository not configured for project', code: 'CONFIG_ERROR' },
        { status: 500 }
      );
    }

    const octokit = createGitHubClient();
    const githubPath = `ticket-assets/${ticketId}/${file.name}`;
    const oldFilename = existingAttachments[attachmentIndex]?.filename || 'unknown';

    await commitImageToRepo(octokit, {
      owner: ticket.project.githubOwner,
      repo: ticket.project.githubRepo,
      path: githubPath,
      content: buffer,
      message: `Replace image ${oldFilename} with ${file.name} in ticket ${ticketId}`,
      authorName: 'AI Board',
      authorEmail: 'noreply@ai-board.dev',
    });

    // Construct GitHub raw URL
    const downloadUrl = `https://raw.githubusercontent.com/${ticket.project.githubOwner}/${ticket.project.githubRepo}/main/${githubPath}`;

    // Create new attachment object
    const newAttachment: TicketAttachment = {
      type: 'uploaded',
      url: downloadUrl,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      uploadedAt: new Date().toISOString(),
    };

    // Replace attachment at index (preserve array position)
    const updatedAttachments = [...existingAttachments];
    updatedAttachments[attachmentIndex] = newAttachment;

    // Update ticket in database
    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        attachments: updatedAttachments as unknown as Prisma.InputJsonValue,
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

    console.error('Error replacing image:', error);
    return NextResponse.json(
      { error: 'Failed to replace image', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
