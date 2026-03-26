import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import {
  hasWorkflowToken,
  verifyWorkflowToken,
} from '@/app/lib/auth/workflow-auth';
import { getRankedTickets } from '@/lib/search/command-palette-ranking';
import type { CommandPaletteTicketResult } from '@/lib/types';
import type { SearchResponse, SearchResult } from '@/app/lib/types/search';

/**
 * GET /api/projects/[projectId]/tickets/search
 * Searches tickets by key, title, and description within the specified project
 *
 * Authentication: Supports both session auth (UI) and Bearer token (workflow)
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdStr } = await context.params;
    const projectId = parseInt(projectIdStr, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    // Dual auth: workflow Bearer token OR session auth
    if (hasWorkflowToken(request)) {
      // Workflow authentication
      const isAuthorized = await verifyWorkflowToken(request);
      if (!isAuthorized) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      // Verify project exists (workflow doesn't need ownership check)
      const projectExists = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true },
      });
      if (!projectExists) {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        );
      }
    } else {
      // Session authentication (UI)
      await verifyProjectAccess(projectId);
    }

    // Get query param
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() ?? '';
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '10', 10), 50);

    if (query.length < 2) {
      return NextResponse.json(
        { error: 'Query must be at least 2 characters' },
        { status: 400 }
      );
    }

    const tickets = await prisma.ticket.findMany({
      where: { projectId },
      select: {
        id: true,
        projectId: true,
        ticketKey: true,
        title: true,
        stage: true,
      },
      take: 100,
      orderBy: { updatedAt: 'desc' },
    });

    const sortedTickets = getRankedTickets(tickets, query, limit).map((ticket: CommandPaletteTicketResult) => ({
      id: Number(ticket.id.replace('ticket:', '')),
      ticketKey: ticket.ticketKey,
      title: ticket.label,
      stage: ticket.stage,
    })) as SearchResult[];

    const response: SearchResponse = {
      results: sortedTickets,
      totalCount: sortedTickets.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      if (error.message === 'Project not found') {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
