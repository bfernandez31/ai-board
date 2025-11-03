import { NextRequest, NextResponse } from 'next/server';
import { ProjectIdSchema } from '@/lib/validations/ticket';
import { getProjectById } from '@/lib/db/projects';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/workflow-auth';
import { resolveTicket } from '@/app/lib/utils/ticket-resolver';
import { previewUrlSchema } from '@/app/lib/schemas/deploy-preview';
import { z } from 'zod';

/**
 * Request body schema for preview URL update
 */
const updatePreviewUrlSchema = z.object({
  previewUrl: previewUrlSchema,
});

/**
 * PATCH /api/projects/[projectId]/tickets/[id]/preview-url
 * Workflow-only endpoint for updating ticket preview URL after deployment
 *
 * **Authentication**: Bearer token (WORKFLOW_API_TOKEN)
 * **Authorization**: None (workflow-only endpoint)
 *
 * Request Body:
 * {
 *   "previewUrl": "https://*.vercel.app"
 * }
 *
 * Success Response (200):
 * {
 *   "id": 123,
 *   "previewUrl": "https://ai-board-080-preview.vercel.app",
 *   "updatedAt": "2025-11-03T14:35:00Z"
 * }
 *
 * Error Responses:
 * - 400: Invalid preview URL format (Zod validation)
 * - 401: Unauthorized (invalid workflow token)
 * - 404: Project or ticket not found
 * - 500: Internal server error
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    // Validate workflow authentication (Bearer token)
    const authResult = validateWorkflowAuth(request);
    if (!authResult.isValid) {
      console.error('[Preview URL Update] Authentication failed:', authResult.error);
      return NextResponse.json(
        { error: 'Unauthorized: Invalid workflow token' },
        { status: 401 }
      );
    }

    // Await params in Next.js 15
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdentifier } = params;

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

    // Check if project exists
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        {
          error: 'Project not found',
          code: 'PROJECT_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parseResult = updatePreviewUrlSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const { previewUrl } = parseResult.data;

    // Support both numeric ID and ticketKey (e.g., ABC-123)
    const currentTicket = await resolveTicket(projectId, ticketIdentifier);

    if (!currentTicket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Update preview URL
    const updatedTicket = await prisma.ticket.update({
      where: { id: currentTicket.id },
      data: {
        previewUrl,
        // updatedAt automatically updated by @updatedAt directive
      },
      select: {
        id: true,
        previewUrl: true,
        updatedAt: true,
      },
    });

    console.log('[Preview URL Update] Success:', {
      ticketId: updatedTicket.id,
      previewUrl: updatedTicket.previewUrl,
    });

    return NextResponse.json(
      {
        id: updatedTicket.id,
        previewUrl: updatedTicket.previewUrl,
        updatedAt: updatedTicket.updatedAt.toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating ticket preview URL:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
