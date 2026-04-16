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

  // try/finally guarantees temp upload files are cleaned up on every post-validation
  // path — including when DB writes throw, which the previous scattered cleanups missed.
  try {
    const ticket = await createTicket(projectId, {
      ...input,
      attachments: undefined,
    });

    const attachments: TicketAttachment[] = [];

    if (validatedFiles.length > 0) {
      const { uploadImageToCloudinary, deleteImageFromCloudinary, isCloudinaryConfigured } =
        await import('@/app/lib/cloudinary/client');

      if (!isCloudinaryConfigured()) {
        return {
          ok: false,
          status: 500,
          error: {
            error:
              'Cloudinary not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.',
            code: 'CONFIG_ERROR',
          },
        };
      }

      // Promise.allSettled (vs. Promise.all) lets us see which uploads succeeded when
      // one fails, so we can roll those back instead of leaking orphaned Cloudinary assets.
      const uploadResults = await Promise.allSettled(
        validatedFiles.map(({ file, buffer, validation, filename }) =>
          uploadImageToCloudinary(buffer, {
            folder: `ai-board/tickets/${ticket.id}`,
            filename: filename.replace(/\.[^/.]+$/, ''),
            resourceType: 'image',
          }).then(
            (cloudinaryResult): TicketAttachment => ({
              type: 'uploaded',
              url: cloudinaryResult.url,
              filename,
              mimeType: validation.mimeType || file.mimetype || 'application/octet-stream',
              sizeBytes: file.size,
              uploadedAt: new Date().toISOString(),
              cloudinaryPublicId: cloudinaryResult.publicId,
            })
          )
        )
      );

      const succeeded = uploadResults
        .filter(
          (r): r is PromiseFulfilledResult<TicketAttachment> => r.status === 'fulfilled'
        )
        .map((r) => r.value);
      const firstFailure = uploadResults.find(
        (r): r is PromiseRejectedResult => r.status === 'rejected'
      );

      if (firstFailure) {
        // Best-effort rollback: delete any uploads that did succeed so they don't become
        // orphans with no DB record pointing at their publicId. allSettled prevents one
        // delete failure from masking another.
        await Promise.allSettled(
          succeeded
            .map((a) => a.cloudinaryPublicId)
            .filter((id): id is string => Boolean(id))
            .map((publicId) => deleteImageFromCloudinary(publicId))
        );

        const firstError = firstFailure.reason;
        return {
          ok: false,
          status: 500,
          error: {
            error: `Failed to upload image to Cloudinary: ${firstError instanceof Error ? firstError.message : 'Unknown error'}`,
            code: 'UPLOAD_ERROR',
          },
        };
      }

      attachments.push(...succeeded);
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
      // Cast required: TicketAttachment[] is Zod-validated plain JSON (strings, numbers, booleans)
      // but TypeScript cannot structurally prove assignability to Prisma's recursive InputJsonValue type.
      const validatedAttachments = attachmentsValidation.data as unknown as Prisma.InputJsonValue;
      finalTicket = await prisma.ticket.update({
        where: { id: ticket.id },
        data: { attachments: validatedAttachments },
      });
    }

    return { ok: true, ticket: finalTicket };
  } finally {
    if (uploadedFiles.length > 0) {
      await cleanupFiles(uploadedFiles);
    }
  }
}
