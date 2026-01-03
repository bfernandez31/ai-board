import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import {
  hasWorkflowToken,
  verifyWorkflowToken,
} from '@/app/lib/auth/workflow-auth';
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

    // Search tickets
    const tickets = await prisma.ticket.findMany({
      where: {
        projectId,
        OR: [
          { ticketKey: { contains: query, mode: 'insensitive' } },
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        ticketKey: true,
        title: true,
        stage: true,
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });

    // Sort by relevance (key exact match > key contains > title contains > description)
    const queryLower = query.toLowerCase();
    const sortedTickets = [...tickets].sort((a, b) => {
      const scoreA = getRelevanceScore(a, queryLower);
      const scoreB = getRelevanceScore(b, queryLower);
      return scoreB - scoreA;
    });

    const response: SearchResponse = {
      results: sortedTickets as SearchResult[],
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

/**
 * Calculate relevance score for sorting
 * Higher score = more relevant
 *
 * Priority order:
 * 1. Exact key match (score: 4)
 * 2. Key contains query (score: 3)
 * 3. Title contains query (score: 2)
 * 4. Description match only (score: 1)
 */
function getRelevanceScore(
  ticket: { ticketKey: string; title: string },
  queryLower: string
): number {
  const keyLower = ticket.ticketKey.toLowerCase();
  const titleLower = ticket.title.toLowerCase();

  if (keyLower === queryLower) {
    return 4; // Exact key match
  }
  if (keyLower.includes(queryLower)) {
    return 3; // Key contains query
  }
  if (titleLower.includes(queryLower)) {
    return 2; // Title contains query
  }
  return 1; // Description match (default - still matched by Prisma query)
}
