/**
 * Project-wide Comparisons API Route
 *
 * GET /api/projects/:projectId/comparisons
 * Returns all comparison records for a project from the database with pagination.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

/**
 * GET - List all comparisons for a project (DB-backed)
 */
export async function GET(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const { projectId } = await context.params;
    const projectIdNum = parseInt(projectId, 10);

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    try {
      await verifyProjectAccess(projectIdNum);
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const parseResult = querySchema.safeParse({
      limit: searchParams.get('limit') ?? 20,
      offset: searchParams.get('offset') ?? 0,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      );
    }

    const { limit, offset } = parseResult.data;

    const [records, total] = await prisma.$transaction([
      prisma.comparisonRecord.findMany({
        where: { projectId: projectIdNum },
        orderBy: { generatedAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          sourceTicket: {
            select: { ticketKey: true, title: true },
          },
          winnerTicket: {
            select: { ticketKey: true, title: true },
          },
          participants: {
            orderBy: { rank: 'asc' },
            include: {
              ticket: {
                select: { ticketKey: true },
              },
            },
          },
        },
      }),
      prisma.comparisonRecord.count({
        where: { projectId: projectIdNum },
      }),
    ]);

    const comparisons = records.map((record) => {
      const winner = record.participants.find(
        (p) => p.ticketId === record.winnerTicketId
      );

      return {
        id: record.id,
        generatedAt: record.generatedAt.toISOString(),
        sourceTicketKey: record.sourceTicket.ticketKey,
        sourceTicketTitle: record.sourceTicket.title,
        winnerTicketKey: record.winnerTicket.ticketKey,
        winnerTicketTitle: record.winnerTicket.title,
        winnerScore: winner?.score ?? 0,
        participantCount: record.participants.length,
        participantTicketKeys: record.participants.map((p) => p.ticket.ticketKey),
        summary: record.summary,
        keyDifferentiators: Array.isArray(record.keyDifferentiators)
          ? record.keyDifferentiators.filter((item): item is string => typeof item === 'string')
          : [],
      };
    });

    return NextResponse.json({
      comparisons,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching project comparisons:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
