import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyTicketAccess } from '@/lib/db/auth-helpers';
import { getTicketComparisonCheck } from '@/lib/comparison/comparison-detail';

const paramsSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  id: z.coerce.number().int().positive(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const paramsResult = paramsSchema.safeParse(await context.params);
    if (!paramsResult.success) {
      return NextResponse.json(
        { error: 'Invalid project or ticket ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { projectId, id: ticketId } = paramsResult.data;
    const ticket = await verifyTicketAccess(ticketId, request);
    if (ticket.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Forbidden', code: 'WRONG_PROJECT' },
        { status: 403 }
      );
    }

    return NextResponse.json(await getTicketComparisonCheck(ticketId));
  } catch (error) {
    if (error instanceof Error && error.message === 'Ticket not found') {
      return NextResponse.json(
        { error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
