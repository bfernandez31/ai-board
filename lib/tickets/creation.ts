import { promises as fs } from 'fs';
import type formidable from 'formidable';
import type { Ticket, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { createTicket } from '@/lib/db/tickets';
import { validateImageFile } from '@/app/lib/validations/image';
import { extractImageUrls } from '@/app/lib/parsers/markdown';
import { TicketAttachmentsArraySchema } from '@/app/lib/schemas/ticket';
import type { TicketAttachment } from '@/app/lib/types/ticket';
import type { CreateTicketInput } from '@/lib/validations/ticket';

/** Discriminated result returned by createTicketWithAttachments. */
export type CreateTicketResult =
  | { ok: true; ticket: Ticket }
  | { ok: false; status: number; error: { error: string; code: string } };

interface ValidatedFileEntry {
  file: formidable.File;
  buffer: Buffer;
  validation: { valid: true; mimeType: string };
  filename: string;
}

async function cleanupFiles(files: formidable.File[]): Promise<void> {
  for (const file of files) {
    try {
      await fs.unlink(file.filepath);
    } catch (cleanupError) {
      console.error('Error cleaning up file:', cleanupError);
    }
  }
}

/**
 * Create a ticket in INBOX and attach uploaded + external images.
 *
 * Pipeline:
 * 1. Extract external image URLs from description
 * 2. Validate each uploaded image buffer
 * 3. Create ticket without attachments
 * 4. Upload validated images to Cloudinary
 * 5. Append external images (up to 5 total)
 * 6. Update ticket with final attachments array
 */
export async function createTicketWithAttachments(
  projectId: number,
  input: CreateTicketInput,
  uploadedFiles: formidable.File[]
): Promise<CreateTicketResult> {
  const externalImages = extractImageUrls(input.description);

  if (uploadedFiles.length > 5) {
    return {
      ok: false,
      status: 400,
      error: {
        error: 'Maximum 5 uploaded images allowed per ticket',
        code: 'VALIDATION_ERROR',
      },
    };
  }

  const validatedFiles: ValidatedFileEntry[] = [];

  if (uploadedFiles.length > 0) {
    for (const file of uploadedFiles) {
      const buffer = await fs.readFile(file.filepath);
      const validation = await validateImageFile(
        buffer,
        file.mimetype || 'application/octet-stream',
        file.size
      );

      if (!validation.valid) {
        await cleanupFiles(uploadedFiles);
        return {
          ok: false,
          status: 400,
          error: {
            error: `Image validation failed: ${validation.error}`,
            code: 'VALIDATION_ERROR',
          },
        };
      }

      const timestamp = Date.now();
      const safeFilename = file.originalFilename
        ?.replace(/\.\./g, '_')
        ?.replace(/[^a-zA-Z0-9._-]/g, '_')
        || `image_${timestamp}`;
      const filename = `${timestamp}_${safeFilename}`;

      validatedFiles.push({
        file,
        buffer,
        validation: validation as { valid: true; mimeType: string },
        filename,
      });
    }
  }

  const ticket = await createTicket(projectId, {
    ...input,
    attachments: undefined,
  });

  const attachments: TicketAttachment[] = [];

  if (validatedFiles.length > 0) {
    const { uploadImageToCloudinary, isCloudinaryConfigured } = await import(
      '@/app/lib/cloudinary/client'
    );

    if (!isCloudinaryConfigured()) {
      await cleanupFiles(uploadedFiles);
      throw new Error(
        'Cloudinary not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.'
      );
    }

    for (const { file, buffer, validation, filename } of validatedFiles) {
      try {
        const cloudinaryResult = await uploadImageToCloudinary(buffer, {
          folder: `ai-board/tickets/${ticket.id}`,
          filename: filename.replace(/\.[^/.]+$/, ''),
          resourceType: 'image',
        });

        attachments.push({
          type: 'uploaded',
          url: cloudinaryResult.url,
          filename,
          mimeType: validation.mimeType || file.mimetype || 'application/octet-stream',
          sizeBytes: file.size,
          uploadedAt: new Date().toISOString(),
          cloudinaryPublicId: cloudinaryResult.publicId,
        });
      } catch (error) {
        await cleanupFiles(uploadedFiles);
        throw new Error(
          `Failed to upload image to Cloudinary: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    await cleanupFiles(uploadedFiles);
  }

  for (const { alt, url } of externalImages) {
    if (attachments.length >= 5) break;
    attachments.push({
      type: 'external',
      url,
      filename: alt || 'External Image',
      mimeType: 'image/png',
      sizeBytes: 0,
      uploadedAt: new Date().toISOString(),
    });
  }

  const attachmentsValidation = TicketAttachmentsArraySchema.safeParse(attachments);
  if (!attachmentsValidation.success) {
    return {
      ok: false,
      status: 400,
      error: {
        error: `Attachments validation failed: ${attachmentsValidation.error.message}`,
        code: 'VALIDATION_ERROR',
      },
    };
  }

  let finalTicket = ticket;
  if (attachments.length > 0) {
    finalTicket = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { attachments: attachments as unknown as Prisma.InputJsonValue },
    });
  }

  return { ok: true, ticket: finalTicket };
}
