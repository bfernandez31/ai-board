/**
 * Timeline API Route
 * Feature: 065-915-conversations-je
 *
 * GET /api/projects/[projectId]/tickets/[id]/timeline
 * Returns unified conversation timeline (comments + job events) chronologically sorted
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { verifyTicketAccess } from '@/lib/db/auth-helpers';
import { requireAuth } from '@/lib/db/users';
import { mergeConversationEvents } from '@/app/lib/utils/conversation-events';
import { extractMentionUserIds } from '@/app/lib/utils/mention-parser';

/**
 * Schema for route parameters validation
 */
const RouteParamsSchema = z.object({
  projectId: z.string().regex(/^\d+$/),
  id: z.string().regex(/^\d+$/),
});

/**
 * GET /api/projects/[projectId]/tickets/[id]/timeline
 *
 * Fetches unified conversation timeline for a ticket, including:
 * - User comments with author information
 * - Job lifecycle events (PENDING/RUNNING → start, COMPLETED/FAILED/CANCELLED → completion)
 *
 * Chronologically sorted (oldest first) for natural conversation flow.
 *
 * @returns {ConversationEvent[]} Unified timeline array
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdString } = params;

    // T010: Validate route parameters
    const paramsResult = RouteParamsSchema.safeParse({
      projectId: projectIdString,
      id: ticketIdString,
    });

    if (!paramsResult.success) {
      return NextResponse.json(
        { error: 'Invalid project ID or ticket ID' },
        { status: 400 }
      );
    }

    const projectId = parseInt(projectIdString, 10);
    const ticketId = parseInt(ticketIdString, 10);

    // Verify ticket access (owner OR member via project)
    const ticket = await verifyTicketAccess(ticketId);

    // Validate ticket belongs to correct project
    if (ticket.projectId !== projectId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get current user ID for response (used by frontend for ownership checks)
    const currentUserId = await requireAuth();

    // Fetch comments with user relation (chronological order)
    const comments = await prisma.comment.findMany({
      where: { ticketId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' }, // Most recent first
    });

    // Extract all mentioned user IDs from all comments
    const allMentionedUserIds = comments.flatMap((comment) =>
      extractMentionUserIds(comment.content)
    );
    const uniqueUserIds = Array.from(new Set(allMentionedUserIds));

    // Fetch mentioned users (LEFT JOIN behavior for deleted users)
    const mentionedUsers = await prisma.user.findMany({
      where: { id: { in: uniqueUserIds } },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    // Create user map for client-side mention resolution
    const mentionedUsersMap = Object.fromEntries(
      mentionedUsers.map((user) => [user.id, user])
    );

    // T013: Fetch jobs with VERIFY/SHIP exclusion filter (chronological order)
    // VERIFY and SHIP stages are out of scope (no jobs for those stages yet)
    const jobs = await prisma.job.findMany({
      where: {
        ticketId,
        // Exclude VERIFY and SHIP stage jobs (out of scope for this feature)
        command: {
          notIn: ['verify', 'ship'],
        },
      },
      orderBy: { startedAt: 'desc' }, // Most recent first
    });

    // T014: Transform comments to API format with ISO timestamps
    const commentsWithISOTimestamps = comments.map((comment) => ({
      id: comment.id,
      ticketId: comment.ticketId,
      userId: comment.userId,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      user: {
        id: comment.user.id,
        name: comment.user.name,
        email: comment.user.email,
        image: comment.user.image,
      },
    }));

    // T014: Merge and sort events using utility function
    const timeline = mergeConversationEvents(commentsWithISOTimestamps, jobs);

    // Return unified timeline with mentioned users
    return NextResponse.json({
      timeline,
      mentionedUsers: mentionedUsersMap,
      currentUserId, // Include in body for frontend ownership checks
    });
  } catch (error) {
    console.error('[Timeline API Error]', error);

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
    }

    return NextResponse.json(
      { error: 'Internal server error', code: 'DATABASE_ERROR' },
      { status: 500 }
    );
  }
}
