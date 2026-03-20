/**
 * GET /api/projects/[projectId]/tickets/[id]/comparisons/db
 *
 * Lists all comparisons a specific ticket participates in (bidirectional via ComparisonEntry).
 * Uses session auth via verifyProjectAccess.
 *
 * @param request - Next.js request object
 * @param context - Route context with projectId and ticket id params
 *
 * @returns JSON response with paginated comparison list
 *
 * @throws 400 - Invalid project or ticket ID, invalid pagination params
 * @throws 401 - Unauthorized
 * @throws 404 - Ticket not found in project
 * @throws 500 - Internal server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { z } from 'zod';

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(
  request: NextRequest,
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

    // Parse pagination
    const { searchParams } = new URL(request.url);
    const paginationResult = paginationSchema.safeParse({
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    });

    if (!paginationResult.success) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { limit, offset } = paginationResult.data;

    // Count total comparisons this ticket participates in
    const total = await prisma.comparisonEntry.count({
      where: { ticketId: ticketIdNum },
    });

    // Query comparisons this ticket participates in
    const entries = await prisma.comparisonEntry.findMany({
      where: { ticketId: ticketIdNum },
      include: {
        comparison: {
          include: {
            sourceTicket: {
              select: { ticketKey: true },
            },
            entries: {
              select: {
                ticketId: true,
                rank: true,
                score: true,
                isWinner: true,
              },
            },
          },
        },
      },
      orderBy: {
        comparison: {
          createdAt: 'desc',
        },
      },
      skip: offset,
      take: limit,
    });

    const comparisons = entries.map((entry) => {
      const comparison = entry.comparison;
      return {
        id: comparison.id,
        sourceTicketKey: comparison.sourceTicket.ticketKey,
        recommendation: comparison.recommendation,
        createdAt: comparison.createdAt.toISOString(),
        entryCount: comparison.entries.length,
        ticketRank: entry.rank,
        ticketScore: entry.score,
        ticketIsWinner: entry.isWinner,
        winnerTicketKey: null as string | null,
      };
    });

    // Resolve winner ticket keys in bulk
    if (comparisons.length > 0) {
      const winnerTicketIds = entries
        .map((entry) => {
          const winner = entry.comparison.entries.find((e) => e.isWinner);
          return winner?.ticketId;
        })
        .filter((id): id is number => id !== undefined);

      const uniqueWinnerIds = [...new Set(winnerTicketIds)];

      if (uniqueWinnerIds.length > 0) {
        const winnerTickets = await prisma.ticket.findMany({
          where: { id: { in: uniqueWinnerIds } },
          select: { id: true, ticketKey: true },
        });

        const winnerKeyMap = new Map(
          winnerTickets.map((t) => [t.id, t.ticketKey])
        );

        for (let i = 0; i < comparisons.length; i++) {
          const entry = entries[i];
          const comparison = comparisons[i];
          if (!entry || !comparison) continue;
          const winner = entry.comparison.entries.find((e) => e.isWinner);
          if (winner) {
            comparison.winnerTicketKey =
              winnerKeyMap.get(winner.ticketId) ?? null;
          }
        }
      }
    }

    return NextResponse.json({
      comparisons,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error listing ticket comparisons from DB:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
