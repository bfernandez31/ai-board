import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getTicketsByStage, createTicket } from '@/lib/db/tickets';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { CreateTicketSchema, ProjectIdSchema } from '@/lib/validations/ticket';
import { TicketAttachmentsArraySchema } from '@/app/lib/schemas/ticket';
import { validateImageFile } from '@/app/lib/validations/image';
import { commitImageToRepo } from '@/app/lib/github/operations';
import { createGitHubClient } from '@/app/lib/github/client';
import { extractImageUrls } from '@/app/lib/parsers/markdown';
import type { TicketAttachment } from '@/app/lib/types/ticket';
import { ZodError } from 'zod';
import formidable, { Fields, Files } from 'formidable';
import { promises as fs } from 'fs';
import { Readable } from 'stream';
import { prisma } from '@/lib/db/client';

/**
 * GET /api/projects/[projectId]/tickets
 * Returns all tickets for a specific project, grouped by stage
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdString } = await context.params;

    // Validate projectId format
    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid project ID',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    const projectId = parseInt(projectIdString, 10);

    // Verify project ownership (throws if unauthorized or not found)
    await verifyProjectOwnership(projectId);

    // Fetch tickets for this project
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

/**
 * Parse multipart/form-data request using formidable
 */
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

/**
 * POST /api/projects/[projectId]/tickets
 * Creates a new ticket in the INBOX stage for the specified project
 * Supports both JSON and multipart/form-data (with image uploads)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdString } = await context.params;

    // Validate projectId format
    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid project ID',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    const projectId = parseInt(projectIdString, 10);

    // Verify project ownership (throws if unauthorized or not found)
    const project = await verifyProjectOwnership(projectId);

    const contentType = request.headers.get('content-type') || '';
    let ticketData: { title: string; description: string; clarificationPolicy?: string };
    let uploadedFiles: formidable.File[] = [];

    // Parse request based on content type
    if (contentType.includes('multipart/form-data')) {
      // Parse multipart/form-data
      const { fields, files } = await parseFormData(request);

      // Extract ticket data from fields
      const title = Array.isArray(fields.title) ? fields.title[0] : fields.title;
      const description = Array.isArray(fields.description) ? fields.description[0] : fields.description;
      const clarificationPolicy = Array.isArray(fields.clarificationPolicy)
        ? fields.clarificationPolicy[0]
        : fields.clarificationPolicy;

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
      };

      // Extract uploaded files
      if (files.images) {
        uploadedFiles = Array.isArray(files.images) ? files.images : [files.images];
      }
    } else {
      // Parse JSON (backward compatibility)
      const body = await request.json();
      ticketData = body;
    }

    // Validate ticket data
    const result = CreateTicketSchema.safeParse(ticketData);

    if (!result.success) {
      const flattened = result.error.flatten();

      // Create a descriptive error message from field errors
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

    // Extract external image URLs from markdown description FIRST (no ticket ID needed)
    const externalImages = extractImageUrls(result.data.description);

    // Validate total attachment count (uploaded + external)
    const totalAttachments = uploadedFiles.length + externalImages.length;
    if (totalAttachments > 5) {
      return NextResponse.json(
        {
          error: 'Maximum 5 images allowed per ticket (uploaded + external URLs)',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    // Validate uploaded files BEFORE creating ticket
    const validatedFiles: Array<{
      file: formidable.File;
      buffer: Buffer;
      validation: { valid: true; mimeType: string };
      filename: string;
    }> = [];

    if (uploadedFiles.length > 0) {
      for (const file of uploadedFiles) {
        // Read file buffer
        const buffer = await fs.readFile(file.filepath);

        // Validate image file
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

        // Generate safe filename
        const timestamp = Date.now();
        const safeFilename = file.originalFilename?.replace(/[^a-zA-Z0-9._-]/g, '_') || `image_${timestamp}`;
        const filename = `${timestamp}_${safeFilename}`;

        validatedFiles.push({
          file,
          buffer,
          validation: validation as { valid: true; mimeType: string },
          filename,
        });
      }
    }

    // Create ticket WITHOUT attachments first (to get ticket ID)
    const ticket = await createTicket(projectId, {
      ...result.data,
      attachments: undefined, // Will be updated after image upload
    });

    // Now process uploaded images using ticket ID
    const attachments: TicketAttachment[] = [];

    if (validatedFiles.length > 0) {
      const octokit = createGitHubClient();

      for (const { file, buffer, validation, filename } of validatedFiles) {
        // Commit image to GitHub using ticket ID in path
        try {
          await commitImageToRepo(octokit, {
            owner: project.githubOwner,
            repo: project.githubRepo,
            branch: 'main',
            path: `ticket-assets/${ticket.id}/${filename}`,
            content: buffer,
            message: `Add image attachment for ticket ${ticket.id}: ${filename}`,
            authorName: 'AI Board',
            authorEmail: 'noreply@ai-board.dev',
          });

          // Create attachment object
          attachments.push({
            type: 'uploaded',
            url: `https://raw.githubusercontent.com/${project.githubOwner}/${project.githubRepo}/main/ticket-assets/${ticket.id}/${filename}`,
            filename,
            mimeType: validation.mimeType || file.mimetype || 'application/octet-stream',
            sizeBytes: file.size,
            uploadedAt: new Date().toISOString(),
          });
        } catch (error) {
          // Clean up uploaded files on GitHub commit failure
          for (const f of uploadedFiles) {
            try {
              await fs.unlink(f.filepath);
            } catch (cleanupError) {
              console.error('Error cleaning up file:', cleanupError);
            }
          }

          throw new Error(`Failed to commit image to GitHub: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Clean up temporary files after successful upload
      for (const file of uploadedFiles) {
        try {
          await fs.unlink(file.filepath);
        } catch (error) {
          console.error('Error cleaning up temporary file:', error);
        }
      }
    }

    // Add external image URLs to attachments
    for (const { alt, url } of externalImages) {
      attachments.push({
        type: 'external',
        url,
        filename: alt || 'External Image',
        mimeType: 'image/png', // Default, actual MIME type unknown for external URLs
        sizeBytes: 0, // Unknown for external URLs
        uploadedAt: new Date().toISOString(),
      });
    }

    // Validate final attachments array
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

    // Update ticket with attachments if any exist
    if (attachments.length > 0) {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { attachments: attachments as any },
      });

      // Update the ticket object to include attachments for response
      ticket.attachments = attachments as any;
    }

    // Revalidate the project board page
    revalidatePath(`/projects/${projectId}/board`);

    // Return created ticket with 201 status
    return NextResponse.json(
      {
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        stage: ticket.stage,
        version: ticket.version,
        projectId: ticket.projectId,
        branch: ticket.branch,
        autoMode: ticket.autoMode,
        attachments: ticket.attachments,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/projects/[projectId]/tickets:', error);

    // Handle authentication errors
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
      if (error.message.includes('No boundary found')) {
        return NextResponse.json(
          { error: 'Invalid multipart/form-data request', code: 'VALIDATION_ERROR' },
          { status: 400 }
        );
      }
    }

    // Handle Zod validation errors
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

    // Handle database errors
    return NextResponse.json(
      {
        error: 'Failed to create ticket',
        code: 'DATABASE_ERROR',
      },
      { status: 500 }
    );
  }
}

// Disable Next.js body parsing for multipart/form-data
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
