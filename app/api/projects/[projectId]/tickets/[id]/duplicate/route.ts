import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import {
  duplicateTicket,
  fullCloneTicket,
  FullCloneValidationError,
  BranchNotFoundError,
  GitHubPermissionError,
} from '@/lib/db/tickets';
import { ProjectIdSchema, FullCloneQuerySchema } from '@/lib/validations/ticket';
import { z } from 'zod';

// Schema for validating ticket ID parameter
const TicketIdSchema = z.string().regex(/^\d+$/, 'Ticket ID must be a positive integer');

/**
 * Serializes a ticket to the API response format
 */
function serializeTicketResponse(ticket: {
  id: number;
  ticketNumber: number;
  ticketKey: string;
  title: string;
  description: string | null;
  stage: string;
  version: number;
  projectId: number;
  branch: string | null;
  previewUrl: string | null;
  autoMode: boolean;
  workflowType: string;
  attachments: unknown;
  clarificationPolicy: string | null;
  createdAt: Date;
  updatedAt: Date;
}, jobsCloned?: number) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    ticketKey: ticket.ticketKey,
    title: ticket.title,
    description: ticket.description,
    stage: ticket.stage,
    version: ticket.version,
    projectId: ticket.projectId,
    branch: ticket.branch,
    previewUrl: ticket.previewUrl,
    autoMode: ticket.autoMode,
    workflowType: ticket.workflowType,
    attachments: ticket.attachments,
    clarificationPolicy: ticket.clarificationPolicy,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    ...(jobsCloned !== undefined && { jobsCloned }),
  };
}

/**
 * POST /api/projects/[projectId]/tickets/[id]/duplicate
 *
 * Duplicates an existing ticket. Supports two modes:
 *
 * Simple copy (default):
 * - Creates new ticket in INBOX stage
 * - Prefixes title with "Copy of "
 * - Copies description, policy, attachments
 * - No branch, no jobs
 *
 * Full clone (with ?fullClone=true):
 * - Preserves current stage
 * - Prefixes title with "Clone of "
 * - Creates new branch from source branch
 * - Copies all jobs with telemetry data
 * - Only available for tickets in SPECIFY, PLAN, BUILD, or VERIFY stages with a branch
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
) {
  try {
    const { projectId: projectIdString, id: ticketIdString } = await context.params;

    // Parse fullClone query parameter
    const { searchParams } = new URL(request.url);
    const fullClone = FullCloneQuerySchema.parse(searchParams.get('fullClone'));

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

    // Verify project access (owner OR member)
    await verifyProjectAccess(projectId);

    // Handle full clone vs simple copy
    if (fullClone) {
      // Full clone requires GitHub token
      const githubToken = process.env.GITHUB_TOKEN;
      if (!githubToken) {
        return NextResponse.json(
          {
            error: 'GitHub token not configured',
            code: 'GITHUB_ERROR',
          },
          { status: 500 }
        );
      }

      // Perform full clone
      const newTicket = await fullCloneTicket(projectId, ticketId, githubToken);
      revalidatePath(`/projects/${projectId}/board`);
      return NextResponse.json(
        serializeTicketResponse(newTicket, newTicket.jobsCloned),
        { status: 201 }
      );
    }

    // Simple copy (default behavior)
    const newTicket = await duplicateTicket(projectId, ticketId);
    revalidatePath(`/projects/${projectId}/board`);
    return NextResponse.json(
      serializeTicketResponse(newTicket),
      { status: 201 }
    );
  } catch (error) {
    // Handle specific errors
    if (error instanceof FullCloneValidationError) {
      return NextResponse.json(
        { error: error.message, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    if (error instanceof BranchNotFoundError) {
      return NextResponse.json(
        { error: 'Source branch not found in GitHub', code: 'BRANCH_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (error instanceof GitHubPermissionError) {
      return NextResponse.json(
        { error: 'Failed to create branch in GitHub. Check repository permissions.', code: 'GITHUB_ERROR' },
        { status: 500 }
      );
    }

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
