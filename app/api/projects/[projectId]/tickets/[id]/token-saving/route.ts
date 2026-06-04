import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { verifyTicketAccess } from '@/lib/db/auth-helpers';
import {
  tokenSavingOverrideSchema,
  patchTicketTokenSaving,
} from '@/lib/db/tickets';

/**
 * PATCH /api/projects/[projectId]/tickets/[id]/token-saving
 *
 * Sets the per-ticket token-saving override (AIB-849). Mirrors model-config:
 * deliberately NO INBOX stage gate — editable at any stage (FR-013), but
 * rejected with 409 ACTIVE_RUN while a RUNNING/PENDING job exists on the ticket.
 * `tokenSaving: null` clears the override (→ project default, FR-015).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; id: string }> }
) {
  try {
    const { projectId: projectIdParam, id } = await params;
    const ticketId = parseInt(id, 10);
    const projectId = parseInt(projectIdParam, 10);

    if (isNaN(ticketId) || isNaN(projectId)) {
      return NextResponse.json(
        { error: 'Invalid ticket or project ID' },
        { status: 400 }
      );
    }

    await verifyTicketAccess(ticketId, request);

    const body = await request.json();
    const { tokenSaving, version } = tokenSavingOverrideSchema.parse(body);

    const result = await patchTicketTokenSaving(ticketId, projectId, version, tokenSaving);

    if (!result.ok) {
      return NextResponse.json(result.body, { status: result.status });
    }

    return NextResponse.json({
      tokenSaving: result.ticket.tokenSaving,
      version: result.ticket.version,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', code: 'VALIDATION_ERROR', issues: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'Ticket not found') {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (
      error instanceof Error &&
      (error.message === 'Authentication required' || error.message === 'Unauthorized')
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('Ticket token-saving PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
