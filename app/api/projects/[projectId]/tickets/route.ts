import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getTicketsByStage, createTicket } from '@/lib/db/tickets';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { requireAuth } from '@/lib/db/users';
import { canCreateTicket } from '@/lib/stripe/subscription';
import { CreateTicketSchema, ProjectIdSchema } from '@/lib/validations/ticket';
import { TicketAttachmentsArraySchema } from '@/app/lib/schemas/ticket';
import { validateImageFile } from '@/app/lib/validations/image';
import { extractImageUrls } from '@/app/lib/parsers/markdown';
import type { TicketAttachment } from '@/app/lib/types/ticket';
import { ZodError } from 'zod';
import formidable, { Fields, Files } from 'formidable';
import { promises as fs } from 'fs';
import { Readable } from 'stream';
import { prisma } from '@/lib/db/client';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdString } = await context.params;

    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      return NextResponse.json({ error: 'Invalid project ID', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const projectId = parseInt(projectIdString, 10);
    await verifyProjectAccess(projectId, request);

    const ticketsByStage = await getTicketsByStage(projectId);
    return NextResponse.json(ticketsByStage, { status: 200 });
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
          { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
          { status: 404 }
        );
      }
    }

    console.error('Error fetching tickets:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch tickets',
        code: 'DATABASE_ERROR',
      },
      { status: 500 }
    );
  }
}

async function parseFormData(request: NextRequest): Promise<{ fields: Fields; files: Files }> {
  const form = formidable({
    maxFiles: 5, // Max 5 images per ticket
    maxFileSize: 10 * 1024 * 1024, // 10MB per file
    allowEmptyFiles: false,
    filter: (part) => {
      // Only allow image files
      return part.mimetype?.startsWith('image/') || false;
    },
  });

  // Convert NextRequest to Node.js IncomingMessage-like object
  const buffer = await request.arrayBuffer();

  const contentType = request.headers.get('content-type');

  const boundary = contentType?.match(/boundary=(.+)$/)?.[1];

  if (!boundary) {
    throw new Error('No boundary found in multipart/form-data request');
  }

  // Create a proper Node.js Readable stream
  const nodeStream = new Readable({
    read() {
      // Push the buffer data
      this.push(Buffer.from(buffer));
      // Signal end of stream
      this.push(null);
    },
  });

  // Add required properties for formidable
  (nodeStream as any).headers = Object.fromEntries(request.headers.entries());
  (nodeStream as any).method = request.method;
  (nodeStream as any).url = request.url;

  return new Promise((resolve, reject) => {
    form.parse(nodeStream as any, (err, fields, files) => {
      if (err) {
        reject(err);
      } else {
        resolve({ fields, files });
      }
    });
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdString } = await context.params;

    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      return NextResponse.json({ error: 'Invalid project ID', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const projectId = parseInt(projectIdString, 10);
    await verifyProjectAccess(projectId, request);

    // Check plan limits before creating ticket
    const userId = await requireAuth(request);
    const allowed = await canCreateTicket(userId);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Monthly ticket limit reached for your plan. Please upgrade to create more tickets.', code: 'PLAN_LIMIT' },
        { status: 403 }
      );
    }

    const contentType = request.headers.get('content-type') || '';
    let ticketData: { title: string; description: string; clarificationPolicy?: string; agent?: string };
    let uploadedFiles: formidable.File[] = [];

    if (contentType.includes('multipart/form-data')) {
      let fields, files;
      try {
        const parsed = await parseFormData(request);
        fields = parsed.fields;
        files = parsed.files;
      } catch (error: any) {
        if (error.code === 1015) {
          return NextResponse.json(
            {
              error: 'Maximum 5 images allowed per ticket',
              code: 'VALIDATION_ERROR',
            },
            { status: 400 }
          );
        }
        if (error.code === 1009) {
          return NextResponse.json(
            {
              error: 'Total file size exceeds 10MB limit',
              code: 'VALIDATION_ERROR',
            },
            { status: 400 }
          );
        }
        throw error;
      }

      const title = Array.isArray(fields.title) ? fields.title[0] : fields.title;
      const description = Array.isArray(fields.description) ? fields.description[0] : fields.description;
      const clarificationPolicy = Array.isArray(fields.clarificationPolicy)
        ? fields.clarificationPolicy[0]
        : fields.clarificationPolicy;
      const agent = Array.isArray(fields.agent)
        ? fields.agent[0]
        : fields.agent;

      if (!title || !description) {
        return NextResponse.json(
          {
            error: 'Missing required fields: title and description',
            code: 'VALIDATION_ERROR',
          },
          { status: 400 }
        );
      }

      ticketData = {
        title,
        description,
        ...(clarificationPolicy && { clarificationPolicy }),
        ...(agent && { agent }),
      };

      if (files.images) {
        uploadedFiles = Array.isArray(files.images) ? files.images : [files.images];
      }
    } else {
      const body = await request.json();
      ticketData = body;
    }

    const result = CreateTicketSchema.safeParse(ticketData);

    if (!result.success) {
      const flattened = result.error.flatten();

        const fieldErrorMessages = Object.entries(flattened.fieldErrors)
        .map(
          ([field, errors]) =>
            `${field}: ${(errors as string[] | undefined)?.join(', ') || 'error'}`
        )
        .join('; ');

      const errorMessage = fieldErrorMessages || 'Invalid input';

      return NextResponse.json(
        {
          error: errorMessage,
          code: 'VALIDATION_ERROR',
          details: {
            fieldErrors: flattened.fieldErrors,
            formErrors: flattened.formErrors,
          },
        },
        { status: 400 }
      );
    }

    const externalImages = extractImageUrls(result.data.description);

    if (uploadedFiles.length > 5) {
      return NextResponse.json(
        {
          error: 'Maximum 5 uploaded images allowed per ticket',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    const validatedFiles: Array<{
      file: formidable.File;
      buffer: Buffer;
      validation: { valid: true; mimeType: string };
      filename: string;
    }> = [];

    if (uploadedFiles.length > 0) {
      for (const file of uploadedFiles) {
        const buffer = await fs.readFile(file.filepath);
        const validation = await validateImageFile(
          buffer,
          file.mimetype || 'application/octet-stream',
          file.size
        );

        if (!validation.valid) {
          // Clean up uploaded files on validation failure
          for (const f of uploadedFiles) {
            try {
              await fs.unlink(f.filepath);
            } catch (cleanupError) {
              console.error('Error cleaning up file:', cleanupError);
            }
          }

          return NextResponse.json(
            {
              error: `Image validation failed: ${validation.error}`,
              code: 'VALIDATION_ERROR',
            },
            { status: 400 }
          );
        }

        const timestamp = Date.now();
        const safeFilename = file.originalFilename
          ?.replace(/\.\./g, '_')  // Replace .. first
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
      ...result.data,
      attachments: undefined,
    });

    const attachments: TicketAttachment[] = [];

    if (validatedFiles.length > 0) {
      const { uploadImageToCloudinary, isCloudinaryConfigured } = await import('@/app/lib/cloudinary/client');

      if (!isCloudinaryConfigured()) {
        for (const file of uploadedFiles) {
          try {
            await fs.unlink(file.filepath);
          } catch (error) {
            console.error('Error cleaning up temporary file:', error);
          }
        }
        throw new Error('Cloudinary not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.');
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
          for (const f of uploadedFiles) {
            try {
              await fs.unlink(f.filepath);
            } catch (cleanupError) {
              console.error('Error cleaning up file:', cleanupError);
            }
          }

          throw new Error(`Failed to upload image to Cloudinary: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      for (const file of uploadedFiles) {
        try {
          await fs.unlink(file.filepath);
        } catch (error) {
          console.error('Error cleaning up temporary file:', error);
        }
      }
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
      return NextResponse.json(
        {
          error: `Attachments validation failed: ${attachmentsValidation.error.message}`,
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    let finalTicket = ticket;
    if (attachments.length > 0) {
      finalTicket = await prisma.ticket.update({
        where: { id: ticket.id },
        data: { attachments: attachments as any },
      });
    }

    revalidatePath(`/projects/${projectId}/board`);

    return NextResponse.json(
      {
        id: finalTicket.id,
        ticketNumber: finalTicket.ticketNumber,
        ticketKey: finalTicket.ticketKey,
        title: finalTicket.title,
        description: finalTicket.description,
        stage: finalTicket.stage,
        version: finalTicket.version,
        projectId: finalTicket.projectId,
        branch: finalTicket.branch,
        autoMode: finalTicket.autoMode,
        agent: finalTicket.agent,
        attachments: finalTicket.attachments,
        createdAt: finalTicket.createdAt.toISOString(),
        updatedAt: finalTicket.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/projects/[projectId]/tickets:', error);
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_ERROR' }, { status: 401 });
      if (error.message === 'Project not found') return NextResponse.json({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' }, { status: 404 });
      if (error.message.includes('No boundary found')) return NextResponse.json({ error: 'Invalid multipart/form-data request', code: 'VALIDATION_ERROR' }, { status: 400 });
    }
    if (error instanceof ZodError) {
      const flattened = error.flatten();

      const fieldErrorMessages = Object.entries(flattened.fieldErrors)
        .map(
          ([field, errors]) =>
            `${field}: ${(errors as string[] | undefined)?.join(', ') || 'error'}`
        )
        .join('; ');

      const errorMessage = fieldErrorMessages || 'Invalid input';

      return NextResponse.json(
        {
          error: errorMessage,
          code: 'VALIDATION_ERROR',
          details: {
            fieldErrors: flattened.fieldErrors,
            formErrors: flattened.formErrors,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to create ticket', code: 'DATABASE_ERROR' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
