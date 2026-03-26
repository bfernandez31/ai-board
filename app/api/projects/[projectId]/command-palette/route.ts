import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { commandPaletteQuerySchema } from '@/lib/schemas/command-palette';
import { getProjectDestinations } from '@/components/navigation/project-destinations';
import {
  getRankedDestinations,
  getRankedTickets,
} from '@/lib/search/command-palette-ranking';
import type {
  CommandPaletteDestinationResult,
  CommandPaletteResponse,
  CommandPaletteTicketResult,
} from '@/lib/types';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdString } = await context.params;
    const projectId = parseInt(projectIdString, 10);

    if (Number.isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    await verifyProjectAccess(projectId, request);

    const parsedQuery = commandPaletteQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries())
    );

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: parsedQuery.error.issues[0]?.message ?? 'Invalid query parameters' },
        { status: 400 }
      );
    }

    const { q, limit } = parsedQuery.data;
    const rankedDestinations = getRankedDestinations(getProjectDestinations(projectId), q);

    const ticketCandidates = q
      ? await prisma.ticket.findMany({
          where: { projectId },
          select: {
            id: true,
            projectId: true,
            ticketKey: true,
            title: true,
            stage: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        })
      : [];

    const rankedTickets = getRankedTickets(ticketCandidates, q, limit);

    const response: CommandPaletteResponse = {
      query: q,
      groups: {
        destinations: rankedDestinations as CommandPaletteDestinationResult[],
        tickets: rankedTickets as CommandPaletteTicketResult[],
      },
      totalCount: {
        destinations: rankedDestinations.length,
        tickets: rankedTickets.length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    console.error('Command palette error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
