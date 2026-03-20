/**
 * GET /api/projects/[projectId]/tickets/[id]/comparisons/db/check
 *
 * Lightweight check returning whether a ticket has any comparisons in the database.
 *
 * @param _request - Next.js request object (unused)
 * @param context - Route context with projectId and ticket id params
 *
 * @returns JSON response with hasComparisons boolean and count
 *
 * @throws 400 - Invalid project or ticket ID
 * @throws 401 - Unauthorized
 * @throws 404 - Ticket not found in project
 * @throws 500 - Internal server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdString } = params;

    const projectIdNum = parseInt(projectIdString, 10);
    const ticketIdNum = parseInt(ticketIdString, 10);

    if (isNaN(projectIdNum) || isNaN(ticketIdNum)) {
      return NextResponse.json(
        { error: 'Invalid project ID or ticket ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Session auth
    try {
      await verifyProjectAccess(projectIdNum);
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Verify ticket exists in project
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketIdNum, projectId: projectIdNum },
      select: { id: true },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found in project', code: 'TICKET_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Count comparisons
    const count = await prisma.comparisonEntry.count({
      where: { ticketId: ticketIdNum },
    });

    return NextResponse.json({
      hasComparisons: count > 0,
      count,
    });
  } catch (error) {
    console.error('Error checking ticket comparisons in DB:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
