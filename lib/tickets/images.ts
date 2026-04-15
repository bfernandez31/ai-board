import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { isTicketAttachmentArray } from '@/app/lib/types/ticket';
import type { TicketAttachment } from '@/app/lib/types/ticket';

/** Image metadata enriched with its index in the attachments array. */
export type TicketImageWithIndex = TicketAttachment & { index: number };

/** Discriminated result returned by listTicketImages. */
export type ListTicketImagesResult =
  | { ok: true; images: TicketImageWithIndex[] }
  | { ok: false; status: number; body: Record<string, unknown> };

/** Discriminated result returned by uploadTicketImage. */
export type UploadTicketImageResult =
  | { ok: true; attachments: Prisma.JsonValue; version: number }
  | { ok: false; status: number; body: Record<string, unknown> };

/** Fetch the attachments of a ticket, enriched with array indices. */
export async function listTicketImages(
  projectId: number,
  ticketId: number
): Promise<ListTicketImagesResult> {
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, projectId },
    select: { attachments: true },
  });

  if (!ticket) {
    return {
      ok: false,
      status: 404,
      body: { error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
    };
  }

  const attachments = ticket.attachments ?? [];

  if (!isTicketAttachmentArray(attachments)) {
    console.error('Invalid attachments structure for ticket', ticketId, attachments);
    return {
      ok: false,
      status: 500,
      body: { error: 'Invalid attachments data', code: 'DATA_ERROR' },
    };
  }

  const imagesWithIndex = attachments.map((attachment, index) => ({
    index,
    ...attachment,
  }));

  return { ok: true, images: imagesWithIndex };
}

/**
 * Upload a new image to an existing ticket.
 *
 * Enforces:
 *  - Ticket must exist within the project
 *  - Edit permission gated on ticket.stage via canEdit(stage, 'images')
 *    (images are only editable in SPECIFY/PLAN)
 *  - Optimistic concurrency via `version`
 *  - Max 5 attachments per ticket
 *  - Cloudinary must be configured
 */
export async function uploadTicketImage(
  projectId: number,
  ticketId: number,
  file: File,
  version: number
): Promise<UploadTicketImageResult> {
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, projectId },
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
    return {
      ok: false,
      status: 404,
      body: { error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
    };
  }

  const { canEdit } = await import('@/components/ticket/edit-permission-guard');
  if (!canEdit(ticket.stage, 'images')) {
    return {
      ok: false,
      status: 403,
      body: {
        error: `Cannot edit images in ${ticket.stage} stage. Images can only be edited in SPECIFY and PLAN stages.`,
        code: 'FORBIDDEN',
      },
    };
  }

  if (ticket.version !== version) {
    return {
      ok: false,
      status: 409,
      body: {
        error: 'Ticket was modified by another user. Please refresh and try again.',
        code: 'CONFLICT',
      },
    };
  }

  const existingAttachments = ticket.attachments ?? [];
  if (!isTicketAttachmentArray(existingAttachments)) {
    console.error('Invalid attachments structure for ticket', ticketId, existingAttachments);
    return {
      ok: false,
      status: 500,
      body: { error: 'Invalid attachments data', code: 'DATA_ERROR' },
    };
  }

  if (existingAttachments.length >= 5) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Maximum 5 images per ticket', code: 'VALIDATION_ERROR' },
    };
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { uploadImageToCloudinary, isCloudinaryConfigured } = await import(
    '@/app/lib/cloudinary/client'
  );

  if (!isCloudinaryConfigured()) {
    return {
      ok: false,
      status: 500,
      body: {
        error:
          'Cloudinary not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.',
        code: 'CONFIG_ERROR',
      },
    };
  }

  const cloudinaryResult = await uploadImageToCloudinary(buffer, {
    folder: `ai-board/tickets/${ticketId}`,
    filename: file.name.replace(/\.[^/.]+$/, ''),
    resourceType: 'image',
  });

  const newAttachment: TicketAttachment = {
    type: 'uploaded',
    url: cloudinaryResult.url,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    uploadedAt: new Date().toISOString(),
    cloudinaryPublicId: cloudinaryResult.publicId,
  };

  const updatedAttachments = [...existingAttachments, newAttachment];

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

  return {
    ok: true,
    attachments: updatedTicket.attachments,
    version: updatedTicket.version,
  };
}
