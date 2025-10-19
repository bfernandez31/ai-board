/**
 * GET /api/projects/[projectId]/tickets/[id]/tasks
 *
 * Retrieves the tasks.md file for a ticket from GitHub.
 *
 * @param request - Next.js request object
 * @param context - Route context with projectId and ticket id params
 *
 * @returns JSON response with tasks content and metadata
 *
 * @throws 400 - Invalid project or ticket ID
 * @throws 403 - Ticket belongs to different project
 * @throws 404 - Project, ticket, or tasks file not found
 * @throws 500 - GitHub API error or internal server error
 *
 * @example
 * GET /api/projects/1/tickets/123/tasks
 * Response: { content: "# Task Breakdown...", metadata: {...} }
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProjectIdSchema } from '@/lib/validations/ticket';
import { getProjectById } from '@/lib/db/projects';
import { prisma } from '@/lib/db/client';
import { fetchDocumentContent } from '@/lib/github/doc-fetcher';

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

    // Query ticket with project-scoped validation and job filtering
    // Note: tasks.md is created by the plan job, so we check for completed plan job
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, projectId: projectId },
      include: {
        jobs: {
          where: { command: 'plan', status: 'COMPLETED' },
          take: 1,
        },
        project: true,
      },
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

    // Check if ticket has branch assigned
    if (!ticket.branch) {
      console.error('Ticket has no branch assigned:', {
        ticketId,
        projectId,
      });
      return NextResponse.json(
        {
          error: 'Tasks not available',
          code: 'BRANCH_NOT_ASSIGNED',
          message: 'Ticket does not have a branch assigned',
        },
        { status: 404 }
      );
    }

    // Check if ticket has completed plan job (which creates tasks.md)
    const hasCompletedPlanJob = ticket.jobs.length > 0;
    if (!hasCompletedPlanJob) {
      console.error('Ticket has no completed plan job:', {
        ticketId,
        projectId,
        branch: ticket.branch,
      });
      return NextResponse.json(
        {
          error: 'Tasks not available',
          code: 'NOT_AVAILABLE_YET',
          message: 'Ticket does not have a completed "plan" job',
        },
        { status: 404 }
      );
    }

    // Determine branch (SHIP → main, else → feature branch)
    const branch = ticket.stage === 'SHIP' ? 'main' : ticket.branch;

    // Fetch tasks content from GitHub
    try {
      const content = await fetchDocumentContent({
        owner: ticket.project.githubOwner,
        repo: ticket.project.githubRepo,
        branch: branch,
        ticketBranch: ticket.branch,
        docType: 'tasks',
      });

      // Return successful response
      return NextResponse.json({
        content,
        metadata: {
          ticketId: ticket.id,
          branch: branch,
          projectId: ticket.projectId,
          docType: 'tasks',
          fileName: 'tasks.md',
          filePath: `specs/${ticket.branch}/tasks.md`,
          fetchedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('GitHub API error:', {
        projectId,
        ticketId,
        branch: branch,
        owner: ticket.project.githubOwner,
        repo: ticket.project.githubRepo,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Handle specific GitHub API errors
      if (error instanceof Error) {
        if (error.message.includes('rate limit')) {
          return NextResponse.json(
            {
              error: 'GitHub API rate limit exceeded',
              code: 'RATE_LIMIT',
            },
            { status: 429 }
          );
        }

        if (error.message.includes('not found')) {
          return NextResponse.json(
            {
              error: 'Tasks file not found',
              code: 'FILE_NOT_FOUND',
              message: `File does not exist at specs/${ticket.branch}/tasks.md`,
            },
            { status: 404 }
          );
        }
      }

      return NextResponse.json(
        {
          error: 'Failed to fetch tasks',
          code: 'GITHUB_API_ERROR',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    // Catch-all for unexpected errors
    console.error('Error fetching tasks:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
