/**
 * GET /api/projects/[projectId]/tickets/[id]/jobs
 *
 * Retrieves all jobs for a specific ticket within a project.
 *
 * Authentication: Supports both session auth (UI) and Bearer token (workflow)
 *
 * @param request - Next.js request object
 * @param context - Route context with projectId and ticket id params
 *
 * @returns JSON array of jobs with id, command, status, completedAt fields
 *
 * @throws 400 - Invalid project or ticket ID
 * @throws 401 - Unauthorized (invalid Bearer token)
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
import { prisma } from '@/lib/db/client';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import {
  hasWorkflowToken,
  verifyWorkflowToken,
} from '@/app/lib/auth/workflow-auth';

export async function GET(
  request: NextRequest,
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

    // Dual auth: workflow Bearer token OR session auth
    if (hasWorkflowToken(request)) {
      // Workflow authentication
      const isAuthorized = await verifyWorkflowToken(request);
      if (!isAuthorized) {
        return NextResponse.json(
          { error: 'Unauthorized', code: 'UNAUTHORIZED' },
          { status: 401 }
        );
      }
      // Verify project exists (workflow doesn't need ownership check)
      const projectExists = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true },
      });
      if (!projectExists) {
        console.error('Project not found:', { projectId });
        return NextResponse.json(
          { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
          { status: 404 }
        );
      }
    } else {
      // Session authentication (UI)
      await verifyProjectAccess(projectId);
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

    // Fetch all jobs for the ticket with full telemetry
    const jobs = await prisma.job.findMany({
      where: { ticketId: ticketId },
      select: {
        id: true,
        command: true,
        status: true,
        startedAt: true,
        completedAt: true,
        inputTokens: true,
        outputTokens: true,
        cacheReadTokens: true,
        cacheCreationTokens: true,
        costUsd: true,
        durationMs: true,
        model: true,
        toolsUsed: true,
        qualityScore: true,
      },
      orderBy: { id: 'asc' },
    });

    return NextResponse.json(jobs);
  } catch (error) {
    // Handle session auth errors from verifyProjectAccess
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Unauthorized', code: 'UNAUTHORIZED' },
          { status: 401 }
        );
      }
      if (error.message === 'Project not found') {
        return NextResponse.json(
          { error: 'Access denied', code: 'ACCESS_DENIED' },
          { status: 403 }
        );
      }
    }

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
