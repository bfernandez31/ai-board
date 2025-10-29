import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { verifyTicketAccess } from '@/lib/db/auth-helpers';
import { isTicketAttachmentArray } from '@/app/lib/types/ticket';
import type { TicketAttachment } from '@/app/lib/types/ticket';
import { imageFileSchema } from '@/lib/schemas/ticket-image';

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

    // Verify ticket access (owner OR member via project)
    const ticketAuth = await verifyTicketAccess(ticketId);

    // Validate ticket belongs to correct project
    if (ticketAuth.projectId !== projectId) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

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
 * Upload new image to existing ticket
 *
 * Accepts multipart/form-data with:
 * - file: Image file (required)
 * - version: Ticket version for concurrency control (required)
 *
 * @returns 200: Updated attachments array and new version
 * @returns 400: Validation error (file type, size, version missing)
 * @returns 403: Forbidden - cannot edit images in current stage
 * @returns 404: Ticket not found
 * @returns 409: Conflict - version mismatch
 * @returns 500: Internal server error
 */
export async function POST(
  request: NextRequest,
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

    // Verify ticket access (owner OR member via project)
    const ticketAuth = await verifyTicketAccess(ticketId);

    // Validate ticket belongs to correct project
    if (ticketAuth.projectId !== projectId) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

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

    // Check permission: images can only be edited in SPECIFY and PLAN stages
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

    // Check max attachments limit (5 total)
    if (existingAttachments.length >= 5) {
      return NextResponse.json(
        { error: 'Maximum 5 images per ticket', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Convert File to Buffer for Cloudinary upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Cloudinary
    const { uploadImageToCloudinary, isCloudinaryConfigured } = await import('@/app/lib/cloudinary/client');

    if (!isCloudinaryConfigured()) {
      return NextResponse.json(
        { error: 'Cloudinary not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.', code: 'CONFIG_ERROR' },
        { status: 500 }
      );
    }

    // Upload to Cloudinary with folder structure: ai-board/tickets/{ticketId}/
    const cloudinaryResult = await uploadImageToCloudinary(buffer, {
      folder: `ai-board/tickets/${ticketId}`,
      filename: file.name.replace(/\.[^/.]+$/, ''), // Remove extension (Cloudinary adds it)
      resourceType: 'image',
    });

    // Cloudinary URL is publicly accessible
    const downloadUrl = cloudinaryResult.url;

    // Create new attachment object
    const newAttachment: TicketAttachment = {
      type: 'uploaded',
      url: downloadUrl,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      uploadedAt: new Date().toISOString(),
      cloudinaryPublicId: cloudinaryResult.publicId, // Store for deletion
    };

    // Append to attachments array
    const updatedAttachments = [...existingAttachments, newAttachment];

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

    console.error('Error uploading image:', error);
    return NextResponse.json(
      { error: 'Failed to upload image', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
