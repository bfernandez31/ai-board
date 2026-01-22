/**
 * Activity Feed API Endpoint
 * Feature: AIB-172 Project Activity Feed
 *
 * GET /api/projects/:projectId/activity
 * Returns paginated activity events for a project (tickets, jobs, comments)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { getAIBoardUserId } from '@/app/lib/db/ai-board-user';
import {
  activityFeedParamsSchema,
  type ActivityEvent,
  type ActivityFeedResponse,
  type Actor,
} from '@/app/lib/types/activity-event';
import {
  transformTicketToCreatedEvent,
  transformCommentToEvent,
  transformJobToEvents,
  mergeAndSortEvents,
  createActor,
  createAiBoardActor,
} from '@/app/lib/utils/activity-events';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdStr } = await params;
    const projectId = parseInt(projectIdStr, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    // Verify user has access to project (owner or member)
    await verifyProjectAccess(projectId);

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const parseResult = activityFeedParamsSchema.safeParse({
      offset: searchParams.get('offset'),
      limit: searchParams.get('limit'),
      since: searchParams.get('since'),
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { offset, limit } = parseResult.data;

    // Calculate 30-day window
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get AI-BOARD user ID for job actor attribution
    // Use fallback if AI-BOARD user doesn't exist (e.g., test environments)
    let aiBoardUserId: string;
    try {
      aiBoardUserId = await getAIBoardUserId();
    } catch {
      aiBoardUserId = 'ai-board-system-user';
    }
    const aiBoardActor = createAiBoardActor(aiBoardUserId);

    // Fetch data from all sources in parallel (over-fetch to handle filtering)
    const overFetchLimit = limit * 3;

    const [tickets, comments, jobs] = await Promise.all([
      // Tickets created in the last 30 days
      prisma.ticket.findMany({
        where: {
          projectId,
          createdAt: { gte: thirtyDaysAgo },
        },
        orderBy: { createdAt: 'desc' },
        take: overFetchLimit,
      }),

      // Comments in the last 30 days (for this project's tickets)
      prisma.comment.findMany({
        where: {
          ticket: { projectId },
          createdAt: { gte: thirtyDaysAgo },
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
          ticket: {
            select: { id: true, ticketKey: true, projectId: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: overFetchLimit,
      }),

      // Jobs with startedAt or completedAt in the last 30 days
      prisma.job.findMany({
        where: {
          projectId,
          OR: [
            { startedAt: { gte: thirtyDaysAgo } },
            { completedAt: { gte: thirtyDaysAgo } },
          ],
        },
        include: {
          ticket: {
            select: { id: true, ticketKey: true, projectId: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: overFetchLimit,
      }),
    ]);

    // Transform database records to activity events
    const events: ActivityEvent[] = [];
    const actorsMap = new Map<string, Actor>();

    // Helper to add actor to map
    const addActor = (actor: Actor) => {
      if (!actorsMap.has(actor.id)) {
        actorsMap.set(actor.id, actor);
      }
    };

    // Add AI-BOARD actor
    addActor(aiBoardActor);

    // Transform tickets to events
    // Note: Tickets don't have a direct user relation, use AI-BOARD as actor
    // (tickets are created via UI but tracked as board activity)
    for (const ticket of tickets) {
      events.push(transformTicketToCreatedEvent(ticket, aiBoardActor));
    }

    // Transform comments to events
    for (const comment of comments) {
      const actor = createActor(comment.user);
      addActor(actor);
      events.push(transformCommentToEvent(comment));
    }

    // Transform jobs to events (each job can produce 0-2 events)
    for (const job of jobs) {
      const jobEvents = transformJobToEvents(job, aiBoardActor);
      events.push(...jobEvents);
    }

    // Merge and sort all events by timestamp (newest first)
    const sortedEvents = mergeAndSortEvents(events);

    // Calculate total before pagination
    const total = sortedEvents.length;

    // Apply pagination
    const paginatedEvents = sortedEvents.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    // Build actors lookup object
    const actors: Record<string, Actor> = Object.fromEntries(actorsMap);

    const response: ActivityFeedResponse = {
      events: paginatedEvents,
      pagination: {
        offset,
        limit,
        total,
        hasMore,
      },
      actors,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }
    console.error('Activity feed API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
