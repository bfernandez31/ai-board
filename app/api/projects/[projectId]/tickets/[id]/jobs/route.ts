/**
 * GET /api/projects/[projectId]/tickets/[id]/jobs
 *
 * Retrieves all jobs for a specific ticket within a project.
 *
 * @param request - Next.js request object
 * @param context - Route context with projectId and ticket id params
 *
 * @returns JSON array of jobs with id, command, status, completedAt fields
 *
 * @throws 400 - Invalid project or ticket ID
 * @throws 403 - Ticket belongs to different project
 * @throws 404 - Project or ticket not found
 * @throws 500 - Internal server error
 *
 * @example
 * GET /api/projects/1/tickets/123/jobs
 * Response: [{ id: 1, command: "specify", status: "COMPLETED", completedAt: "2025-10-11T..." }]
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProjectIdSchema } from '@/lib/validations/ticket';
import { getProjectById } from '@/lib/db/projects';
import { prisma } from '@/lib/db/client';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdString } = params;

    // Validate projectId
    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      console.error('Invalid project ID:', {
        projectId: projectIdString,
        error: projectIdResult.error.message,
      });
      return NextResponse.json(
        { error: 'Invalid project ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const projectId = parseInt(projectIdString, 10);
    const ticketId = parseInt(ticketIdString, 10);

    // Validate ticketId
    if (isNaN(ticketId)) {
      console.error('Invalid ticket ID:', {
        ticketId: ticketIdString,
        projectId,
      });
      return NextResponse.json(
        { error: 'Invalid ticket ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Verify project exists
    const project = await getProjectById(projectId);
    if (!project) {
      console.error('Project not found:', { projectId });
      return NextResponse.json(
        { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Query ticket with project-scoped validation
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, projectId: projectId },
      select: { id: true },
    });

    // Handle ticket not found or wrong project
    if (!ticket) {
      // Check if ticket exists in a different project (403 vs 404)
      const ticketExists = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true },
      });

      if (ticketExists) {
        console.error('Ticket belongs to different project:', {
          ticketId,
          requestedProjectId: projectId,
        });
        return NextResponse.json(
          { error: 'Forbidden', code: 'WRONG_PROJECT' },
          { status: 403 }
        );
      }

      console.error('Ticket not found:', { ticketId, projectId });
      return NextResponse.json(
        { error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Fetch all jobs for the ticket
    const jobs = await prisma.job.findMany({
      where: { ticketId: ticketId },
      select: {
        id: true,
        command: true,
        status: true,
        completedAt: true,
      },
      orderBy: { id: 'asc' },
    });

    return NextResponse.json(jobs);
  } catch (error) {
    // Catch-all for unexpected errors
    console.error('Error fetching jobs:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
