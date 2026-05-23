import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/db/client';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { bulkUpdateTicketModelConfig, getBulkInboxTicketLookup } from '@/lib/db/tickets';
import { ProjectIdSchema, bulkModelUpdateSchema } from '@/lib/validations/ticket';

function bulkRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', issues: error.issues },
      { status: 400 }
    );
  }

  if (error instanceof Error && error.message === 'Unauthorized') {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_ERROR' }, { status: 401 });
  }

  if (error instanceof Error && error.message === 'Project not found') {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  console.error('Bulk ticket model-config route error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const { projectId: projectIdParam } = await context.params;
    const projectIdResult = ProjectIdSchema.parse(projectIdParam);
    const projectId = parseInt(projectIdResult, 10);

    await verifyProjectAccess(projectId, request);
    const { ticketIds, modelId } = bulkModelUpdateSchema.parse(await request.json());

    const result = await prisma.$transaction(async (tx) => {
      const lookup = await getBulkInboxTicketLookup(tx, projectId, ticketIds);
      if (!lookup.ok) {
        return NextResponse.json(
          { error: 'Bulk action blocked', code: 'BULK_ACTION_BLOCKED', details: lookup.details },
          { status: 409 }
        );
      }

      const updatedTickets = await bulkUpdateTicketModelConfig(
        tx,
        projectId,
        lookup.data.orderedTickets.map((ticket) => ticket.id),
        modelId
      );

      return NextResponse.json({
        success: true,
        appliedModelId: modelId,
        updatedTickets,
      });
    });

    return result;
  } catch (error) {
    return bulkRouteError(error);
  }
}
