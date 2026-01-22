/**
 * Activity Feed API Route
 * Feature: AIB-181-copy-of-project
 *
 * GET /api/projects/[projectId]/activity
 * Returns unified activity timeline (jobs, comments, ticket events) for a project
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { mergeActivityEvents } from '@/app/lib/utils/activity-events';
import type { ActivityFeedResponse } from '@/app/lib/types/activity-event';

/**
 * Schema for route parameters validation
 */
const RouteParamsSchema = z.object({
  projectId: z.string().regex(/^\d+$/, 'Invalid project ID'),
});

/**
 * Schema for query parameters validation
 */
const QueryParamsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

/**
 * GET /api/projects/[projectId]/activity
 *
 * Fetches unified activity timeline for a project, including:
 * - Job lifecycle events (started, completed, failed, cancelled)
 * - Comments posted on tickets
 * - Ticket creation events
 *
 * Results are sorted by timestamp (newest first) and limited to 30 days.
 *
 * @returns ActivityFeedResponse with events, hasMore, offset
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse<ActivityFeedResponse | { error: string; code?: string }>> {
  try {
    const params = await context.params;
    const { projectId: projectIdString } = params;

    // Validate route parameters
    const paramsResult = RouteParamsSchema.safeParse({
      projectId: projectIdString,
    });

    if (!paramsResult.success) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    const projectId = parseInt(projectIdString, 10);

    // Verify project access (owner OR member)
    await verifyProjectAccess(projectId);

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryResult = QueryParamsSchema.safeParse({
      limit: searchParams.get('limit') ?? 50,
      offset: searchParams.get('offset') ?? 0,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      );
    }

    const { limit, offset } = queryResult.data;

    // Calculate 30-day window
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Fetch jobs within 30-day window
    const jobs = await prisma.job.findMany({
      where: {
        projectId,
        startedAt: { gte: thirtyDaysAgo },
      },
      include: {
        ticket: {
          select: {
            id: true,
            ticketKey: true,
            title: true,
            closedAt: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    // Fetch comments within 30-day window
    const comments = await prisma.comment.findMany({
      where: {
        ticket: { projectId },
        createdAt: { gte: thirtyDaysAgo },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        ticket: {
          select: {
            id: true,
            ticketKey: true,
            title: true,
            closedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch tickets created within 30-day window
    const tickets = await prisma.ticket.findMany({
      where: {
        projectId,
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        id: true,
        ticketKey: true,
        title: true,
        closedAt: true,
        createdAt: true,
        workflowType: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Merge and sort all events
    const allEvents = mergeActivityEvents(jobs, comments, tickets);

    // Apply pagination
    const paginatedEvents = allEvents.slice(offset, offset + limit + 1);
    const hasMore = paginatedEvents.length > limit;
    const events = hasMore ? paginatedEvents.slice(0, limit) : paginatedEvents;

    const response: ActivityFeedResponse = {
      events,
      hasMore,
      offset: offset + events.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Activity API Error]', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Unauthorized: Please sign in' },
          { status: 401 }
        );
      }
      if (error.message === 'Forbidden') {
        return NextResponse.json(
          { error: 'Forbidden: You do not have access to this project' },
          { status: 403 }
        );
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: 'Internal server error', code: 'DATABASE_ERROR' },
      { status: 500 }
    );
  }
}
