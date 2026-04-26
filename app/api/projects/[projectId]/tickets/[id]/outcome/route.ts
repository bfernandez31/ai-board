import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { verifyTicketAccess, verifyProjectAccess } from '@/lib/db/auth-helpers';
import { serializeOutcome } from '@/lib/outcomes/serialize';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const projectId = parseInt(params.projectId, 10);
    const ticketId = parseInt(params.id, 10);

    if (!Number.isFinite(projectId) || projectId <= 0) {
      return NextResponse.json(
        { error: 'Invalid project ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }
    if (!Number.isFinite(ticketId) || ticketId <= 0) {
      return NextResponse.json(
        { error: 'Invalid ticket ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    await verifyProjectAccess(projectId, request);
    const ticket = await verifyTicketAccess(ticketId, request);
    if (ticket.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Forbidden', code: 'ACCESS_DENIED' },
        { status: 403 }
      );
    }

    const outcome = await prisma.ticketOutcome.findUnique({ where: { ticketId } });
    if (!outcome) {
      return NextResponse.json(
        { error: 'Outcome not found for ticket', code: 'OUTCOME_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json(serializeOutcome(outcome));
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHENTICATED' },
        { status: 401 }
      );
    }
    if (message === 'Project not found') {
      return NextResponse.json(
        { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
        { status: 404 }
      );
    }
    if (message === 'Ticket not found') {
      return NextResponse.json(
        { error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
        { status: 404 }
      );
    }
    console.error('[api/outcome] error', err);
    return NextResponse.json(
      { error: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
