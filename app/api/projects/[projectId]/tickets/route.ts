import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getTicketsByStage, createTicket } from '@/lib/db/tickets';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { CreateTicketSchema, ProjectIdSchema } from '@/lib/validations/ticket';
import { ZodError } from 'zod';

/**
 * GET /api/projects/[projectId]/tickets
 * Returns all tickets for a specific project, grouped by stage
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    // Await and parse projectId from params (Next.js 15 requirement)
    const params = await context.params;
    const { projectId: projectIdString } = params;

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
 * POST /api/projects/[projectId]/tickets
 * Creates a new ticket in the INBOX stage for the specified project
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    // Await and parse projectId from params
    const params = await context.params;
    const { projectId: projectIdString } = params;

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

    // Parse and validate request body
    const body = await request.json();
    const result = CreateTicketSchema.safeParse(body);

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

    // Create ticket with projectId from URL
    const ticket = await createTicket(projectId, result.data);

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
