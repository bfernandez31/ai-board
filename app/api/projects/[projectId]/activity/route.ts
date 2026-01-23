/**
 * Activity Feed API Route
 * Feature: AIB-177-project-activity-feed
 *
 * GET /api/projects/[projectId]/activity
 * Returns unified activity feed (jobs + comments + tickets) with pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import {
  deriveJobEvents,
  deriveCommentEvent,
  deriveTicketCreatedEvent,
  mergeActivityEvents,
  decodeCursor,
  applyPagination,
  type JobWithTicket,
  type CommentWithUser,
} from '@/app/lib/utils/activity-events';
import type { ActivityFeedResponse } from '@/app/lib/types/activity-event';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

/**
 * GET /api/projects/[projectId]/activity
 *
 * Fetches unified activity feed for a project, including:
 * - Ticket creation events
 * - Job lifecycle events (started, completed, failed)
 * - Stage change events (derived from job completions)
 * - Comment posted events
 * - PR created events (from verify jobs)
 * - Preview deployed events (from deploy-preview jobs)
 *
 * Supports cursor-based pagination for stable "Load more" functionality.
 *
 * @param request - NextRequest with optional query params (limit, cursor)
 * @param context - Route context with projectId param
 * @returns ActivityFeedResponse
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
): Promise<NextResponse<ActivityFeedResponse | { error: string }>> {
  try {
    const { projectId: projectIdStr } = await params;
    const projectId = parseInt(projectIdStr, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    // Verify user has access to this project (owner OR member)
    await verifyProjectAccess(projectId);

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryResult = querySchema.safeParse({
      limit: searchParams.get('limit') ?? undefined,
      cursor: searchParams.get('cursor') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      );
    }

    const { limit, cursor: cursorStr } = queryResult.data;

    // Decode cursor if provided
    const cursor = cursorStr ? decodeCursor(cursorStr) : null;
    if (cursorStr && !cursor) {
      return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 });
    }

    // Calculate 30-day window
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch data in parallel for better performance
    const [jobs, comments, tickets] = await Promise.all([
      // Jobs with ticket relation (for TicketReference)
      prisma.job.findMany({
        where: {
          projectId,
          OR: [
            { startedAt: { gte: thirtyDaysAgo } },
            { completedAt: { gte: thirtyDaysAgo } },
          ],
        },
        include: {
          ticket: true,
        },
        orderBy: { startedAt: 'desc' },
      }),

      // Comments with user and ticket relations
      prisma.comment.findMany({
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
          ticket: true,
        },
        orderBy: { createdAt: 'desc' },
      }),

      // Tickets created in the window
      prisma.ticket.findMany({
        where: {
          projectId,
          createdAt: { gte: thirtyDaysAgo },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Derive events from each source
    const allEvents = [
      // Job events (job_started, job_completed, job_failed, stage_changed, pr_created, preview_deployed)
      ...jobs.flatMap((job) => deriveJobEvents(job as JobWithTicket)),

      // Comment events
      ...comments.map((comment) =>
        deriveCommentEvent(comment as CommentWithUser, comment.ticket)
      ),

      // Ticket created events
      ...tickets.map((ticket) => deriveTicketCreatedEvent(ticket)),
    ];

    // Merge and sort all events
    const sortedEvents = mergeActivityEvents(allEvents);
    const totalCount = sortedEvents.length;

    // Apply pagination
    const paginationResult = applyPagination(sortedEvents, cursor, limit);

    // Build response
    const response: ActivityFeedResponse = {
      events: paginationResult.events,
      pagination: {
        hasMore: paginationResult.hasMore,
        nextCursor: paginationResult.nextCursor,
        totalCount,
        cursorExpired: paginationResult.cursorExpired,
      },
      metadata: {
        projectId,
        rangeStart: thirtyDaysAgo.toISOString(),
        rangeEnd: now.toISOString(),
        fetchedAt: now.toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Activity API Error]', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized: Please sign in' }, { status: 401 });
      }
      if (error.message === 'Forbidden' || error.message === 'Project not found') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
