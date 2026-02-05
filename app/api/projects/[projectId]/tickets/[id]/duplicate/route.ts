import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { duplicateTicket, fullCloneTicket } from '@/lib/db/tickets';
import { ProjectIdSchema } from '@/lib/validations/ticket';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { createGitHubClient } from '@/app/lib/github/client';
import { createBranchFromSource, generateBranchName } from '@/lib/github/branch-operations';

// Schema for validating ticket ID parameter
const TicketIdSchema = z.string().regex(/^\d+$/, 'Ticket ID must be a positive integer');

// Schema for validating request body
const DuplicateRequestSchema = z.object({
  mode: z.enum(['simple', 'full']).optional().default('simple'),
});

/**
 * POST /api/projects/[projectId]/tickets/[id]/duplicate
 * Duplicates an existing ticket.
 *
 * Modes:
 * - "simple" (default): Creates copy in INBOX with "Copy of " prefix, no branch, no jobs
 * - "full": Preserves stage, copies all jobs with telemetry, creates new branch from source
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
) {
  try {
    const { projectId: projectIdString, id: ticketIdString } = await context.params;

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

    // Validate ticketId format
    const ticketIdResult = TicketIdSchema.safeParse(ticketIdString);
    if (!ticketIdResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid ticket ID',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    const projectId = parseInt(projectIdString, 10);
    const ticketId = parseInt(ticketIdString, 10);

    // Parse request body for mode parameter
    const body = await request.json().catch(() => ({}));
    const bodyResult = DuplicateRequestSchema.safeParse(body);
    if (!bodyResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid mode parameter. Must be "simple" or "full"',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }
    const mode = bodyResult.data.mode;

    // Verify project access (owner OR member)
    await verifyProjectAccess(projectId);

    if (mode === 'full') {
      // Full clone: preserve stage, copy jobs, create new branch
      return await handleFullClone(projectId, ticketId);
    } else {
      // Simple copy: existing behavior
      return await handleSimpleCopy(projectId, ticketId);
    }
  } catch (error) {
    // Handle specific errors
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
      if (error.message === 'Ticket not found') {
        return NextResponse.json(
          { error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
          { status: 404 }
        );
      }
    }

    console.error('Error duplicating ticket:', error);
    return NextResponse.json(
      {
        error: 'Failed to duplicate ticket',
        code: 'DATABASE_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle simple copy (existing behavior)
 * Creates copy in INBOX with "Copy of " prefix, no branch, no jobs
 */
async function handleSimpleCopy(projectId: number, ticketId: number) {
  const newTicket = await duplicateTicket(projectId, ticketId);

  // Revalidate the project board page
  revalidatePath(`/projects/${projectId}/board`);

  return NextResponse.json(
    {
      id: newTicket.id,
      ticketNumber: newTicket.ticketNumber,
      ticketKey: newTicket.ticketKey,
      title: newTicket.title,
      description: newTicket.description,
      stage: newTicket.stage,
      version: newTicket.version,
      projectId: newTicket.projectId,
      branch: newTicket.branch,
      previewUrl: newTicket.previewUrl,
      autoMode: newTicket.autoMode,
      workflowType: newTicket.workflowType,
      attachments: newTicket.attachments,
      clarificationPolicy: newTicket.clarificationPolicy,
      createdAt: newTicket.createdAt.toISOString(),
      updatedAt: newTicket.updatedAt.toISOString(),
    },
    { status: 201 }
  );
}

/**
 * Handle full clone
 * Preserves stage, copies all jobs with telemetry, creates new branch from source
 */
async function handleFullClone(projectId: number, ticketId: number) {
  // Fetch source ticket with project info
  const sourceTicket = await prisma.ticket.findFirst({
    where: {
      id: ticketId,
      projectId: projectId,
    },
    include: {
      project: {
        select: {
          key: true,
          githubOwner: true,
          githubRepo: true,
        },
      },
    },
  });

  if (!sourceTicket) {
    return NextResponse.json(
      { error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
      { status: 404 }
    );
  }

  // Validate source ticket has a branch
  if (!sourceTicket.branch) {
    return NextResponse.json(
      {
        error: 'Source ticket has no branch. Full clone requires a branch.',
        code: 'MISSING_BRANCH',
      },
      { status: 400 }
    );
  }

  // Get next ticket number for branch name generation
  const { getNextTicketNumber } = await import('@/app/lib/db/ticket-sequence');
  const nextTicketNumber = await getNextTicketNumber(projectId);

  // Generate new branch name
  const newBranchName = generateBranchName(nextTicketNumber, sourceTicket.title);

  // Create new branch from source branch on GitHub
  try {
    const octokit = createGitHubClient();
    await createBranchFromSource(
      octokit,
      sourceTicket.project.githubOwner,
      sourceTicket.project.githubRepo,
      sourceTicket.branch,
      newBranchName
    );
  } catch (error) {
    console.error('Failed to create branch:', error);

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes('not found on GitHub')) {
        return NextResponse.json(
          {
            error: `Source branch '${sourceTicket.branch}' not found on GitHub`,
            code: 'BRANCH_NOT_FOUND',
          },
          { status: 400 }
        );
      }
      if (error.message.includes('already exists')) {
        return NextResponse.json(
          {
            error: `Branch '${newBranchName}' already exists`,
            code: 'BRANCH_CREATION_FAILED',
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to create branch on GitHub',
        code: 'BRANCH_CREATION_FAILED',
      },
      { status: 500 }
    );
  }

  // Clone the ticket with jobs
  const newTicket = await fullCloneTicket(projectId, ticketId, newBranchName);

  // Revalidate the project board page
  revalidatePath(`/projects/${projectId}/board`);

  return NextResponse.json(
    {
      id: newTicket.id,
      ticketNumber: newTicket.ticketNumber,
      ticketKey: newTicket.ticketKey,
      title: newTicket.title,
      description: newTicket.description,
      stage: newTicket.stage,
      version: newTicket.version,
      projectId: newTicket.projectId,
      branch: newTicket.branch,
      previewUrl: newTicket.previewUrl,
      autoMode: newTicket.autoMode,
      workflowType: newTicket.workflowType,
      attachments: newTicket.attachments,
      clarificationPolicy: newTicket.clarificationPolicy,
      createdAt: newTicket.createdAt.toISOString(),
      updatedAt: newTicket.updatedAt.toISOString(),
      jobs: newTicket.jobs.map((job) => ({
        id: job.id,
        command: job.command,
        status: job.status,
        branch: job.branch,
        commitSha: job.commitSha,
        startedAt: job.startedAt.toISOString(),
        completedAt: job.completedAt?.toISOString() ?? null,
        inputTokens: job.inputTokens,
        outputTokens: job.outputTokens,
        cacheReadTokens: job.cacheReadTokens,
        cacheCreationTokens: job.cacheCreationTokens,
        costUsd: job.costUsd,
        durationMs: job.durationMs,
        model: job.model,
        toolsUsed: job.toolsUsed,
      })),
    },
    { status: 201 }
  );
}
