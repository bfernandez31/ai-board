import { NextRequest, NextResponse } from 'next/server';
import { patchTicketSchema, ProjectIdSchema } from '@/lib/validations/ticket';
import { verifyTicketAccess, verifyProjectAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { canEditDescriptionAndPolicy } from '@/lib/utils/field-edit-permissions';
import { deleteTicketParamsSchema } from '@/lib/schemas/ticket-delete';
import { deleteBranchAndPRs } from '@/lib/github/delete-branch-and-prs';
import { Octokit } from '@octokit/rest';
import { Stage, JobStatus } from '@prisma/client';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdString } = params;

    // Validate projectId format
    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      return NextResponse.json(
        { error: 'Invalid project ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const projectId = parseInt(projectIdString, 10);

    await verifyProjectAccess(projectId, request);

    const isNumericId = /^\d+$/.test(ticketIdString);
    const projectSelect = {
      id: true,
      name: true,
      clarificationPolicy: true,
      defaultAgent: true,
      githubOwner: true,
      githubRepo: true,
    };

    let ticket;

    if (isNumericId) {
      const ticketId = parseInt(ticketIdString, 10);
      const ticketAuth = await verifyTicketAccess(ticketId, request);

      if (ticketAuth.projectId !== projectId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      ticket = await prisma.ticket.findFirst({
        where: { id: ticketId, projectId },
        include: { project: { select: projectSelect } },
      });
    } else {
      ticket = await prisma.ticket.findFirst({
        where: { ticketKey: ticketIdString, projectId },
        include: { project: { select: projectSelect } },
      });
    }

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      ticketKey: ticket.ticketKey,
      title: ticket.title,
      description: ticket.description,
      stage: ticket.stage,
      version: ticket.version,
      projectId: ticket.projectId,
      branch: ticket.branch,
      autoMode: ticket.autoMode,
      clarificationPolicy: ticket.clarificationPolicy,
      agent: ticket.agent,
      workflowType: ticket.workflowType,
      attachments: ticket.attachments,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      project: {
        id: ticket.project.id,
        name: ticket.project.name,
        clarificationPolicy: ticket.project.clarificationPolicy,
        defaultAgent: ticket.project.defaultAgent,
        githubOwner: ticket.project.githubOwner,
        githubRepo: ticket.project.githubRepo,
      },
    });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_ERROR' }, { status: 401 });
      if (error.message === 'Project not found') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      if (error.message === 'Ticket not found') return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdString } = params;

    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      return NextResponse.json({ error: 'Invalid project ID', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const projectId = parseInt(projectIdString, 10);
    await verifyProjectAccess(projectId, request);

    const isNumericId = /^\d+$/.test(ticketIdString);
    let ticketId: number;

    if (isNumericId) {
      ticketId = parseInt(ticketIdString, 10);
      const ticketAuth = await verifyTicketAccess(ticketId, request);
      if (ticketAuth.projectId !== projectId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else {
      const ticket = await prisma.ticket.findFirst({
        where: { ticketKey: ticketIdString, projectId },
        select: { id: true },
      });
      if (!ticket) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
      }
      ticketId = ticket.id;
    }

    const body = await request.json();

    const isStageUpdate = 'stage' in body && !('title' in body || 'description' in body || 'branch' in body || 'autoMode' in body);
    const isInlineEdit = 'title' in body || 'description' in body || 'branch' in body || 'autoMode' in body || 'clarificationPolicy' in body || 'agent' in body;

    if (isInlineEdit) {
      const parseResult = patchTicketSchema.safeParse(body);

      if (!parseResult.success) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            issues: parseResult.error.issues,
          },
          { status: 400 }
        );
      }

      const {
        title,
        description,
        branch,
        autoMode,
        clarificationPolicy,
        agent,
        version: requestVersion,
      } = parseResult.data;

      const currentTicket = await prisma.ticket.findFirst({
        where: { id: ticketId, projectId },
      });

      if (!currentTicket) {
        const ticketExists = await prisma.ticket.findUnique({
          where: { id: ticketId },
          select: { id: true, projectId: true },
        });
        if (!ticketExists) {
          return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      if (currentTicket.version !== requestVersion) {
        return NextResponse.json(
          {
            error: 'Conflict: Ticket was modified by another user',
            currentVersion: currentTicket.version,
          },
          { status: 409 }
        );
      }

      if (
        (description !== undefined || clarificationPolicy !== undefined || agent !== undefined) &&
        !canEditDescriptionAndPolicy(currentTicket.stage)
      ) {
        return NextResponse.json(
          {
            error:
              'Description, clarification policy, and agent can only be updated in INBOX stage',
            code: 'INVALID_STAGE_FOR_EDIT',
          },
          { status: 400 }
        );
      }

      try {
        const updatedTicket = await prisma.ticket.update({
          where: {
            id: ticketId,
            version: requestVersion,
          },
          data: {
            ...(title !== undefined && { title: title.trim() }),
            ...(description !== undefined && {
              description: description.trim(),
            }),
            ...(branch !== undefined && { branch }),
            ...(autoMode !== undefined && { autoMode }),
            ...(clarificationPolicy !== undefined && { clarificationPolicy }),
            ...(agent !== undefined && { agent }),
            version: { increment: 1 },
            updatedAt: new Date(),
          },
        });

        return NextResponse.json(
          {
            id: updatedTicket.id,
            ticketNumber: updatedTicket.ticketNumber,
            ticketKey: updatedTicket.ticketKey,
            title: updatedTicket.title,
            description: updatedTicket.description,
            stage: updatedTicket.stage,
            version: updatedTicket.version,
            projectId: updatedTicket.projectId,
            branch: updatedTicket.branch,
            autoMode: updatedTicket.autoMode,
            clarificationPolicy: updatedTicket.clarificationPolicy,
            agent: updatedTicket.agent,
            workflowType: updatedTicket.workflowType,
            createdAt: updatedTicket.createdAt.toISOString(),
            updatedAt: updatedTicket.updatedAt.toISOString(),
          },
          { status: 200 }
        );
      } catch (updateError) {
        if (updateError instanceof Error && 'code' in updateError && (updateError as { code: string }).code === 'P2025') {
          const latestTicket = await prisma.ticket.findUnique({ where: { id: ticketId } });
          return NextResponse.json({ error: 'Conflict: Ticket was modified by another user', currentVersion: latestTicket?.version || 0 }, { status: 409 });
        }
        throw updateError;
      }
    }

    if (isStageUpdate) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          message: 'Stage transitions must use POST /api/projects/:projectId/tickets/:id/transition endpoint',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Invalid request',
        message: 'Must provide fields to update (title, description, branch, autoMode, clarificationPolicy, or agent)',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating ticket:', error);
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_ERROR' }, { status: 401 });
      if (error.message === 'Project not found') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      if (error.message === 'Ticket not found') return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }
    if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Ticket modified by another user', message: 'The ticket was updated by someone else. Please refresh and try again.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { projectId: projectIdString, id: idString } = params;

    const parseResult = deleteTicketParamsSchema.safeParse({
      projectId: projectIdString,
      id: idString,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request parameters',
          code: 'VALIDATION_ERROR',
          issues: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { projectId, id: ticketId } = parseResult.data;

    const ticket = await verifyTicketAccess(ticketId, request);
    if (ticket.projectId !== projectId) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          code: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    if (ticket.stage === Stage.SHIP) {
      return NextResponse.json(
        {
          error: 'Cannot delete SHIP stage tickets',
          code: 'INVALID_STAGE',
        },
        { status: 400 }
      );
    }

    const hasActiveJob = await prisma.job.findFirst({
      where: {
        ticketId: ticket.id,
        status: { in: [JobStatus.PENDING, JobStatus.RUNNING] },
      },
    });

    if (hasActiveJob) {
      return NextResponse.json(
        {
          error: 'Cannot delete ticket while job is in progress',
          code: 'ACTIVE_JOB',
        },
        { status: 400 }
      );
    }

    let prsClosed = 0;

    if (ticket.branch) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          githubOwner: true,
          githubRepo: true,
        },
      });

      if (!project) {
        return NextResponse.json(
          { error: 'Project not found', code: 'NOT_FOUND' },
          { status: 404 }
        );
      }

      const githubToken = process.env.GITHUB_TOKEN;
      if (!githubToken) {
        return NextResponse.json(
          {
            error: 'GitHub integration not configured',
            code: 'GITHUB_CONFIG_ERROR',
          },
          { status: 500 }
        );
      }

      const octokit = new Octokit({ auth: githubToken });

      try {
        const result = await deleteBranchAndPRs(
          octokit,
          project.githubOwner,
          project.githubRepo,
          ticket.branch
        );

        prsClosed = result.prsClosed;
      } catch (error) {
        console.error('GitHub cleanup failed:', error);

        return NextResponse.json(
          {
            error: 'Failed to delete GitHub artifacts. Please try again.',
            code: 'GITHUB_API_ERROR',
            details: {
              operation: 'delete_branch_and_prs',
              message: error instanceof Error ? error.message : 'Unknown error',
            },
          },
          { status: 500 }
        );
      }
    }

    await prisma.ticket.delete({ where: { id: ticketId } });

    return NextResponse.json(
      {
        success: true,
        deleted: {
          ticketId: ticket.id,
          ticketKey: ticket.ticketKey,
          branch: ticket.branch,
          prsClosed,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Ticket deletion failed:', error);
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized. Please sign in.', code: 'UNAUTHORIZED' }, { status: 401 });
      if (error.message === 'Ticket not found') return NextResponse.json({ error: 'Ticket not found', code: 'NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete ticket', code: 'DATABASE_ERROR', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
