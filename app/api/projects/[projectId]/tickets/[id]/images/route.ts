import { NextRequest, NextResponse } from 'next/server';
import { verifyTicketAccess } from '@/lib/db/auth-helpers';
import { imageFileSchema } from '@/lib/schemas/ticket-image';
import { listTicketImages, uploadTicketImage } from '@/lib/tickets/images';

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

    const result = await listTicketImages(projectId, ticketId);

    if (!result.ok) {
      return NextResponse.json(result.body, { status: result.status });
    }

    return NextResponse.json({ images: result.images }, { status: 200 });
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

    const result = await uploadTicketImage(projectId, ticketId, file, version);

    if (!result.ok) {
      return NextResponse.json(result.body, { status: result.status });
    }

    return NextResponse.json(
      {
        attachments: result.attachments,
        version: result.version,
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
