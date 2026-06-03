import { NextRequest, NextResponse } from 'next/server';
import { patchTicketSchema, ProjectIdSchema } from '@/lib/validations/ticket';
import { verifyTicketAccess, verifyProjectAccess } from '@/lib/db/auth-helpers';
import {
  findTicketForView,
  resolveTicketIdByKey,
  patchTicketInline,
  buildTicketRunSettings,
} from '@/lib/db/tickets';
import { deleteTicketWithCleanup } from '@/lib/tickets/deletion';
import { deleteTicketParamsSchema } from '@/lib/schemas/ticket-delete';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdString } = params;

    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      return NextResponse.json(
        { error: 'Invalid project ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const projectId = parseInt(projectIdString, 10);

    await verifyProjectAccess(projectId, request);

    // For numeric ids, also run the ticket-level auth check so scoped
    // tokens cannot bypass project membership by hitting the ticket directly.
    if (/^\d+$/.test(ticketIdString)) {
      const ticketId = parseInt(ticketIdString, 10);
      const ticketAuth = await verifyTicketAccess(ticketId, request);
      if (ticketAuth.projectId !== projectId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const ticket = await findTicketForView(projectId, ticketIdString);

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
      tokenSavingOverride: ticket.tokenSavingOverride,
      runSettings: buildTicketRunSettings(ticket),
      workflowType: ticket.workflowType,
      attachments: ticket.attachments,
      qualityScore: ticket.jobs[0]?.qualityScore ?? null,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      project: {
        id: ticket.project.id,
        name: ticket.project.name,
        clarificationPolicy: ticket.project.clarificationPolicy,
        defaultAgent: ticket.project.defaultAgent,
        tokenSavingEnabled: ticket.project.tokenSavingEnabled,
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
      const resolved = await resolveTicketIdByKey(projectId, ticketIdString);
      if (resolved === null) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
      }
      ticketId = resolved;
    }

    const body = await request.json();

    const isInlineEdit =
      'title' in body ||
      'description' in body ||
      'branch' in body ||
      'autoMode' in body ||
      'clarificationPolicy' in body ||
      'agent' in body ||
      'tokenSavingOverride' in body;

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
        tokenSavingOverride,
        version: requestVersion,
      } = parseResult.data;

      const result = await patchTicketInline(ticketId, projectId, requestVersion, {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(branch !== undefined && { branch }),
        ...(autoMode !== undefined && { autoMode }),
        ...(clarificationPolicy !== undefined && { clarificationPolicy }),
        ...(agent !== undefined && { agent }),
        ...(tokenSavingOverride !== undefined && { tokenSavingOverride }),
      });

      if (!result.ok) {
        return NextResponse.json(result.body, { status: result.status });
      }

      const updatedTicket = await findTicketForView(projectId, String(result.ticket.id));
      if (!updatedTicket) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
      }

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
          tokenSavingOverride: updatedTicket.tokenSavingOverride,
          runSettings: buildTicketRunSettings(updatedTicket),
          workflowType: updatedTicket.workflowType,
          project: {
            id: updatedTicket.project.id,
            name: updatedTicket.project.name,
            clarificationPolicy: updatedTicket.project.clarificationPolicy,
            defaultAgent: updatedTicket.project.defaultAgent,
            tokenSavingEnabled: updatedTicket.project.tokenSavingEnabled,
            githubOwner: updatedTicket.project.githubOwner,
            githubRepo: updatedTicket.project.githubRepo,
          },
          createdAt: updatedTicket.createdAt.toISOString(),
          updatedAt: updatedTicket.updatedAt.toISOString(),
        },
      );
    }

    if ('stage' in body) {
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
        message: 'Must provide fields to update (title, description, branch, autoMode, clarificationPolicy, agent, or tokenSavingOverride)',
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

    const result = await deleteTicketWithCleanup({
      id: ticket.id,
      projectId: ticket.projectId,
      stage: ticket.stage,
      branch: ticket.branch,
    });

    if (!result.ok) {
      return NextResponse.json(result.body, { status: result.status });
    }

    return NextResponse.json(
      {
        success: true,
        deleted: {
          ticketId: ticket.id,
          ticketKey: ticket.ticketKey,
          branch: ticket.branch,
          prsClosed: result.prsClosed,
        },
      },
    );
  } catch (error) {
    console.error('Ticket deletion failed:', error);
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized. Please sign in.', code: 'UNAUTHORIZED' }, { status: 401 });
      if (error.message === 'Ticket not found') return NextResponse.json({ error: 'Ticket not found', code: 'NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete ticket', code: 'DATABASE_ERROR' }, { status: 500 });
  }
}
