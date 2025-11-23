import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';

/**
 * Schema for route parameters
 */
const RouteParamsSchema = z.object({
  projectId: z.string().regex(/^\d+$/),
});

/**
 * Schema for creating a job
 */
const CreateJobSchema = z.object({
  ticketId: z.number().int().positive(),
  command: z.string().min(1).max(50),
  branch: z.string().optional(),
});

/**
 * POST /api/projects/[projectId]/jobs
 * Create a new job for a ticket (internal use by workflows)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    // Check for workflow token authentication
    const authHeader = request.headers.get('authorization');
    const workflowToken = process.env.WORKFLOW_API_TOKEN;

    if (!workflowToken || !authHeader || authHeader !== `Bearer ${workflowToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid workflow token' },
        { status: 401 }
      );
    }

    const params = await context.params;
    const { projectId: projectIdString } = params;

    // Validate route params
    const paramsResult = RouteParamsSchema.safeParse({
      projectId: projectIdString,
    });

    if (!paramsResult.success) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    const projectId = parseInt(projectIdString, 10);

    // Parse and validate request body
    const body = await request.json();
    const validationResult = CreateJobSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { ticketId, command, branch } = validationResult.data;

    // Verify the ticket exists and belongs to this project
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, projectId: true, branch: true },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    if (ticket.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Ticket does not belong to this project' },
        { status: 400 }
      );
    }

    // Create the job
    const job = await prisma.job.create({
      data: {
        ticketId,
        projectId,
        command,
        status: 'PENDING',
        branch: branch || ticket.branch,
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      id: job.id,
      ticketId: job.ticketId,
      projectId: job.projectId,
      command: job.command,
      status: job.status,
      branch: job.branch,
      startedAt: job.startedAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating job:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}