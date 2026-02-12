import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { verifyTicketAccess } from '@/lib/db/auth-helpers';
import { isTicketAttachmentArray } from '@/app/lib/types/ticket';
import type { TicketAttachment } from '@/app/lib/types/ticket';
import { imageOperationSchema, parseAttachmentIndex } from '@/lib/schemas/ticket-image';

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

    let attachmentIndex: number;
    try {
      attachmentIndex = parseAttachmentIndex(indexString);
    } catch {
      return NextResponse.json({ error: 'Invalid attachment index', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const ticketAuth = await verifyTicketAccess(ticketId);
    if (ticketAuth.projectId !== projectId) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    const body = await request.json();
    const validation = imageOperationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message || 'Invalid request', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const { version } = validation.data;

    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, projectId },
      select: { id: true, stage: true, version: true, attachments: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found', code: 'TICKET_NOT_FOUND' }, { status: 404 });
    }

    const { canEdit } = await import('@/components/ticket/edit-permission-guard');
    if (!canEdit(ticket.stage, 'images')) {
      return NextResponse.json({ error: `Cannot edit images in ${ticket.stage} stage. Images can only be edited in SPECIFY and PLAN stages.`, code: 'FORBIDDEN' }, { status: 403 });
    }

    if (ticket.version !== version) {
      return NextResponse.json({ error: 'Ticket was modified by another user. Please refresh and try again.', code: 'CONFLICT' }, { status: 409 });
    }

    const existingAttachments = ticket.attachments ?? [];
    if (!isTicketAttachmentArray(existingAttachments)) {
      console.error('Invalid attachments structure for ticket', ticketId, existingAttachments);
      return NextResponse.json({ error: 'Invalid attachments data', code: 'DATA_ERROR' }, { status: 500 });
    }

    if (attachmentIndex >= existingAttachments.length) {
      return NextResponse.json({ error: 'Image not found at index', code: 'NOT_FOUND' }, { status: 404 });
    }

    const attachmentToDelete = existingAttachments[attachmentIndex];

    if (attachmentToDelete?.cloudinaryPublicId) {
      const { deleteImageFromCloudinary } = await import('@/app/lib/cloudinary/client');
      try {
        await deleteImageFromCloudinary(attachmentToDelete.cloudinaryPublicId);
      } catch (error) {
        console.error('Failed to delete image from Cloudinary:', error);
      }
    }

    const updatedAttachments = existingAttachments.filter((_, idx) => idx !== attachmentIndex);

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

    let attachmentIndex: number;
    try {
      attachmentIndex = parseAttachmentIndex(indexString);
    } catch {
      return NextResponse.json({ error: 'Invalid attachment index', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const ticketAuth = await verifyTicketAccess(ticketId);
    if (ticketAuth.projectId !== projectId) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Content-Type must be multipart/form-data', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const versionString = formData.get('version') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Missing required field: file', code: 'VALIDATION_ERROR' }, { status: 400 });
    }
    if (!versionString) {
      return NextResponse.json({ error: 'Missing required field: version', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const version = parseInt(versionString, 10);
    if (isNaN(version) || version < 1) {
      return NextResponse.json({ error: 'Invalid version number', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const { imageFileSchema } = await import('@/lib/schemas/ticket-image');
    const fileValidation = imageFileSchema.safeParse({ file, version });
    if (!fileValidation.success) {
      return NextResponse.json({ error: fileValidation.error.issues[0]?.message || 'Invalid file', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, projectId },
      select: {
        id: true, stage: true, version: true, attachments: true,
        project: { select: { githubOwner: true, githubRepo: true } },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found', code: 'TICKET_NOT_FOUND' }, { status: 404 });
    }

    const { canEdit } = await import('@/components/ticket/edit-permission-guard');
    if (!canEdit(ticket.stage, 'images')) {
      return NextResponse.json({ error: `Cannot edit images in ${ticket.stage} stage. Images can only be edited in SPECIFY and PLAN stages.`, code: 'FORBIDDEN' }, { status: 403 });
    }

    if (ticket.version !== version) {
      return NextResponse.json({ error: 'Ticket was modified by another user. Please refresh and try again.', code: 'CONFLICT' }, { status: 409 });
    }

    const existingAttachments = ticket.attachments ?? [];
    if (!isTicketAttachmentArray(existingAttachments)) {
      console.error('Invalid attachments structure for ticket', ticketId, existingAttachments);
      return NextResponse.json({ error: 'Invalid attachments data', code: 'DATA_ERROR' }, { status: 500 });
    }

    if (attachmentIndex >= existingAttachments.length) {
      return NextResponse.json({ error: 'Image not found at index', code: 'NOT_FOUND' }, { status: 404 });
    }

    const oldAttachment = existingAttachments[attachmentIndex];

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { uploadImageToCloudinary, deleteImageFromCloudinary, isCloudinaryConfigured } = await import('@/app/lib/cloudinary/client');
    if (!isCloudinaryConfigured()) {
      return NextResponse.json({ error: 'Cloudinary not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.', code: 'CONFIG_ERROR' }, { status: 500 });
    }

    const cloudinaryResult = await uploadImageToCloudinary(buffer, {
      folder: `ai-board/tickets/${ticketId}`,
      filename: file.name.replace(/\.[^/.]+$/, ''),
      resourceType: 'image',
    });

    if (oldAttachment?.cloudinaryPublicId) {
      try {
        await deleteImageFromCloudinary(oldAttachment.cloudinaryPublicId);
      } catch (error) {
        console.error('Failed to delete old image from Cloudinary:', error);
      }
    }

    const newAttachment: TicketAttachment = {
      type: 'uploaded',
      url: cloudinaryResult.url,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      uploadedAt: new Date().toISOString(),
      cloudinaryPublicId: cloudinaryResult.publicId,
    };

    const updatedAttachments = [...existingAttachments];
    updatedAttachments[attachmentIndex] = newAttachment;

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
