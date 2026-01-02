/**
 * GET /api/projects/[projectId]/tickets/[id]/jobs/full
 *
 * Retrieves all jobs with full telemetry data for a specific ticket.
 * Unlike the basic /jobs endpoint, this returns complete job objects
 * including totalCost, totalDuration, totalTokens, and other telemetry fields.
 *
 * Used by the ticket modal to display detailed job statistics.
 *
 * @param request - Next.js request object
 * @param context - Route context with projectId and ticket id params
 *
 * @returns JSON array of complete Job objects with all telemetry fields
 *
 * @throws 400 - Invalid project or ticket ID
 * @throws 403 - Ticket belongs to different project
 * @throws 404 - Project or ticket not found
 * @throws 500 - Internal server error
 *
 * @example
 * GET /api/projects/1/tickets/123/jobs/full
 * Response: [{ id: 1, command: "specify", status: "COMPLETED", totalCost: 0.05, ... }]
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProjectIdSchema } from '@/lib/validations/ticket';
import { verifyTicketAccess } from '@/lib/db/auth-helpers';
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

    // Verify user has access to this ticket (via project ownership/membership)
    await verifyTicketAccess(ticketId);

    // Fetch all jobs for the ticket with full telemetry data
    const jobs = await prisma.job.findMany({
      where: { ticketId: ticketId },
      orderBy: { startedAt: 'desc' },
    });

    return NextResponse.json(jobs);
  } catch (error) {
    // Handle authorization errors
    if (error instanceof Error && error.message === 'Ticket not found') {
      return NextResponse.json(
        { error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 403 }
      );
    }

    // Catch-all for unexpected errors
    console.error('Error fetching full jobs:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
