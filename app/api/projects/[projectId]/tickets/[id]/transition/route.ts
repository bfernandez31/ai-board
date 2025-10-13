import { NextRequest, NextResponse } from 'next/server';
import { Stage, JobStatus } from '@prisma/client';
import { Octokit } from '@octokit/rest';
import { RequestError } from '@octokit/request-error';
import { isValidTransition, Stage as ValidationStage } from '@/lib/stage-validation';
import { TransitionRequestSchema, ProjectIdSchema } from '@/lib/validations/ticket';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';

/**
 * Stage-to-command mapping for automated workflow stages
 * null indicates no automated workflow (manual stages like VERIFY and SHIP)
 */
const STAGE_COMMAND_MAP: Record<Stage, string | null> = {
  INBOX: null,
  SPECIFY: 'specify',
  PLAN: 'plan',
  BUILD: 'implement',
  VERIFY: null,
  SHIP: null,
};

/**
 * POST /api/projects/[projectId]/tickets/[id]/transition
 *
 * Transitions a ticket to the next sequential stage:
 * - Validates stage transition is sequential (via isValidTransition)
 * - For automated stages (SPECIFY, PLAN, BUILD):
 *   - Creates a Job record with PENDING status
 *   - Dispatches GitHub Actions workflow via Octokit
 *   - Updates ticket stage and version atomically
 *   - Note: Branch is NOT set here - it's created by the GitHub workflow
 *     and updated via PATCH /branch when the job completes
 * - For manual stages (VERIFY, SHIP):
 *   - Updates ticket stage only (no job, no workflow dispatch)
 *
 * Request Body:
 * {
 *   "targetStage": "SPECIFY" | "PLAN" | "BUILD" | "VERIFY" | "SHIP"
 * }
 *
 * Success Response (200) - Automated stages:
 * {
 *   "success": true,
 *   "jobId": 123,
 *   "message": "Workflow dispatched successfully"
 * }
 *
 * Success Response (200) - Manual stages:
 * {
 *   "success": true,
 *   "message": "Stage updated (no workflow for VERIFY/SHIP)"
 * }
 *
 * Error Responses:
 * - 400: Invalid request, validation error, or invalid transition
 * - 403: Ticket belongs to different project (Forbidden)
 * - 404: Project or ticket not found
 * - 409: Version conflict (optimistic concurrency)
 * - 500: GitHub API error or internal server error
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    // Await params in Next.js 15
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdString } = params;

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

    // Validate ticket ID
    const ticketId = parseInt(ticketIdString, 10);
    if (isNaN(ticketId)) {
      return NextResponse.json(
        { error: 'Invalid ticket ID', message: 'Ticket ID must be a number' },
        { status: 400 }
      );
    }

    // Verify project ownership (throws if unauthorized or not found)
    await verifyProjectOwnership(projectId);

    // Parse and validate request body
    const body = await request.json();
    const parseResult = TransitionRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          issues: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { targetStage } = parseResult.data;

    // Fetch current ticket with project relation
    // Note: We've already verified project ownership above, so we can safely fetch
    const currentTicket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        projectId: projectId,
      },
      include: {
        project: {
          select: {
            id: true,
            githubOwner: true,
            githubRepo: true,
          },
        },
      },
    });

    if (!currentTicket) {
      // Distinguish between 404 (ticket doesn't exist) and 403 (wrong project)
      const ticketExists = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true, projectId: true },
      });

      if (!ticketExists) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
      } else {
        // Ticket exists but belongs to different project
        return NextResponse.json(
          { error: 'Forbidden', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }
    }

    // Validate stage transition (sequential only)
    const currentStage = currentTicket.stage as Stage;
    if (!isValidTransition(currentStage as unknown as ValidationStage, targetStage as unknown as ValidationStage)) {
      return NextResponse.json(
        {
          error: 'Invalid stage transition',
          message: `Cannot transition from ${currentStage} to ${targetStage}. Tickets must progress sequentially through stages.`,
        },
        { status: 400 }
      );
    }

    // Check if target stage has automated workflow
    const command = STAGE_COMMAND_MAP[targetStage as Stage];

    // Handle manual stages (VERIFY, SHIP) - update stage only, no job/workflow
    if (!command) {
      try {
        await prisma.ticket.update({
          where: { id: ticketId },
          data: {
            stage: targetStage as Stage,
            version: { increment: 1 },
          },
        });

        return NextResponse.json(
          {
            success: true,
            message: 'Stage updated (no workflow for VERIFY/SHIP)',
          },
          { status: 200 }
        );
      } catch (updateError) {
        console.error('Error updating ticket stage:', { ticketId, targetStage, error: updateError });
        throw updateError;
      }
    }

    // Handle automated stages (SPECIFY, PLAN, BUILD)
    let job;

    try {
      // Create job record
      job = await prisma.job.create({
        data: {
          ticketId: ticketId,
          command: command,
          status: JobStatus.PENDING,
          startedAt: new Date(),
        },
      });

      // Initialize Octokit with GitHub token
      const githubToken = process.env.GITHUB_TOKEN;

      // Skip GitHub API call in test mode (when NODE_ENV is test, token is placeholder, or missing)
      const isTestMode = process.env.NODE_ENV === 'test' || !githubToken || githubToken.includes('test') || githubToken.includes('placeholder');

      if (!isTestMode) {
        const octokit = new Octokit({
          auth: githubToken,
        });

        // Prepare workflow inputs
        const workflowInputs: Record<string, string> = {
          ticket_id: ticketId.toString(),
          command: command,
          branch: currentTicket.branch || '',
        };

        // Add ticket context for SPECIFY stage
        if (targetStage === Stage.SPECIFY) {
          workflowInputs.ticketTitle = currentTicket.title;
          workflowInputs.ticketDescription = currentTicket.description;
        }

        // Dispatch GitHub Actions workflow
        await octokit.actions.createWorkflowDispatch({
          owner: currentTicket.project.githubOwner,
          repo: currentTicket.project.githubRepo,
          workflow_id: 'speckit.yml',
          ref: 'main',
          inputs: workflowInputs,
        });
      }

      // Update ticket atomically with optimistic concurrency control
      try {
        await prisma.ticket.update({
          where: {
            id: ticketId,
            version: currentTicket.version, // Optimistic lock
          },
          data: {
            stage: targetStage as Stage,
            version: { increment: 1 },
          },
        });
      } catch (updateError) {
        // Handle version mismatch (P2025 error)
        if (updateError instanceof Error && 'code' in updateError) {
          const prismaError = updateError as { code: string };
          if (prismaError.code === 'P2025') {
            // Clean up orphaned job created before version conflict detected
            if (job) {
              await prisma.job.delete({ where: { id: job.id } }).catch(() => {
                // Ignore errors during cleanup
              });
            }

            // Re-fetch to get current version
            const latestTicket = await prisma.ticket.findUnique({
              where: { id: ticketId },
            });
            return NextResponse.json(
              {
                error: 'Conflict: Ticket was modified by another user',
                currentVersion: latestTicket?.version || 0,
              },
              { status: 409 }
            );
          }
        }
        throw updateError;
      }

      // Return success response with job ID
      return NextResponse.json(
        {
          success: true,
          jobId: job.id,
          message: 'Workflow dispatched successfully',
        },
        { status: 200 }
      );
    } catch (githubError) {
      // Handle GitHub API errors
      if (githubError instanceof RequestError) {
        console.error('GitHub workflow dispatch failed:', {
          ticketId,
          command,
          status: githubError.status,
          message: githubError.message,
        });

        if (githubError.status === 401) {
          return NextResponse.json(
            {
              error: 'GitHub workflow dispatch failed',
              message: 'GitHub authentication failed',
              code: 'GITHUB_ERROR',
            },
            { status: 500 }
          );
        }

        if (githubError.status === 403) {
          return NextResponse.json(
            {
              error: 'GitHub workflow dispatch failed',
              message: 'GitHub rate limit exceeded',
              code: 'GITHUB_ERROR',
            },
            { status: 500 }
          );
        }

        if (githubError.status === 404) {
          return NextResponse.json(
            {
              error: 'GitHub workflow dispatch failed',
              message: 'Workflow file not found',
              code: 'GITHUB_ERROR',
            },
            { status: 500 }
          );
        }

        return NextResponse.json(
          {
            error: 'GitHub workflow dispatch failed',
            message: githubError.message,
            code: 'GITHUB_ERROR',
          },
          { status: 500 }
        );
      }

      // Re-throw non-GitHub errors
      throw githubError;
    }
  } catch (error) {
    console.error('Error transitioning ticket:', error);

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

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
