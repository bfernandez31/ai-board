import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { createCommentSchema } from '@/app/lib/schemas/comment-validation';
import { requireAuth } from '@/lib/db/users';
import { extractMentionUserIds } from '@/app/lib/utils/mention-parser';
import { getAIBoardUserId } from '@/app/lib/db/ai-board-user';
import { checkAIBoardAvailability } from '@/app/lib/utils/ai-board-availability';
import { dispatchAIBoardWorkflow } from '@/app/lib/workflows/dispatch-ai-board';

/**
 * Schema for route parameters
 */
const RouteParamsSchema = z.object({
  projectId: z.string().regex(/^\d+$/),
  id: z.string().regex(/^\d+$/),
});

/**
 * GET /api/projects/[projectId]/tickets/[id]/comments
 * List all comments for a ticket with author information
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdString } = params;

    // Validate route params
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

    // Verify project ownership (throws if unauthorized or not found)
    await verifyProjectOwnership(projectId);

    // Get current user ID for response header (used by frontend for ownership checks)
    const currentUserId = await requireAuth();

    // Verify ticket exists and belongs to this project
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        projectId: projectId,
      },
      select: { id: true },
    });

    if (!ticket) {
      // Check if ticket exists in different project
      const ticketExists = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true },
      });

      if (!ticketExists) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Fetch comments with user information (newest first)
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
      orderBy: { createdAt: 'desc' },
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

    // Transform to API response format
    const response = {
      comments: comments.map((comment) => ({
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
      })),
      mentionedUsers: mentionedUsersMap,
      currentUserId, // Include in body for TanStack Query cache
    };

    // Return response with currentUserId in both body and header
    return NextResponse.json(response, {
      headers: {
        'X-Current-User-Id': currentUserId,
        'Access-Control-Expose-Headers': 'X-Current-User-Id',
      },
    });
  } catch (error) {
    console.error('Error fetching comments:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized: Please sign in' }, { status: 401 });
      }
      if (error.message === 'Forbidden') {
        return NextResponse.json(
          { error: 'Forbidden: You do not have access to this project' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[projectId]/tickets/[id]/comments
 * Create a new comment on a ticket
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdString } = params;

    // Validate route params
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

    // Verify project ownership (throws if unauthorized or not found)
    // This also validates authentication via requireAuth()
    await verifyProjectOwnership(projectId);

    // Get authenticated user ID
    const userId = await requireAuth();

    // Verify ticket exists and belongs to this project
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        projectId: projectId,
      },
      select: { id: true },
    });

    if (!ticket) {
      // Check if ticket exists in different project
      const ticketExists = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true },
      });

      if (!ticketExists) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = createCommentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { content } = validationResult.data;

    // Validate mentioned users (if any mentions exist)
    const mentionedUserIds = extractMentionUserIds(content);

    if (mentionedUserIds.length > 0) {
      // Verify all mentioned users are project members
      const projectMembers = await prisma.projectMember.findMany({
        where: {
          projectId,
          userId: { in: mentionedUserIds },
        },
        select: { userId: true },
      });

      const validUserIds = new Set(projectMembers.map((m) => m.userId));
      const invalidUserIds = mentionedUserIds.filter(
        (userId) => !validUserIds.has(userId)
      );

      if (invalidUserIds.length > 0) {
        return NextResponse.json(
          {
            error: 'Mentioned user is not a member of this project',
            code: 'INVALID_MENTION_USER',
            details: { invalidUserIds },
          },
          { status: 400 }
        );
      }
    }

    // Check if AI-BOARD is mentioned
    const aiBoardUserId = await getAIBoardUserId();
    const aiBoardMentioned = mentionedUserIds.includes(aiBoardUserId);

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        ticketId,
        userId,
        content,
      },
      include: {
        user: {
          select: {
            name: true,
            image: true,
          },
        },
      },
    });

    // Handle AI-BOARD mention if detected
    let jobId: number | undefined;

    if (aiBoardMentioned) {
      // Check AI-BOARD availability
      const availability = await checkAIBoardAvailability(ticketId);

      if (!availability.available) {
        // Return error if AI-BOARD unavailable
        return NextResponse.json(
          {
            error: `AI-BOARD is not available: ${availability.reason}`,
            code: 'AI_BOARD_UNAVAILABLE',
          },
          { status: 400 }
        );
      }

      // Fetch ticket details for workflow dispatch
      const fullTicket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: {
          id: true,
          title: true,
          stage: true,
          branch: true,
        },
      });

      if (!fullTicket) {
        return NextResponse.json(
          { error: 'Ticket not found' },
          { status: 404 }
        );
      }

      // Create Job record in transaction with concurrency check
      const job = await prisma.$transaction(async (tx) => {
        // Double-check no running jobs (race condition protection)
        const existingJob = await tx.job.findFirst({
          where: {
            ticketId,
            status: { in: ['PENDING', 'RUNNING'] },
          },
        });

        if (existingJob) {
          throw new Error('AI-BOARD already processing this ticket');
        }

        // Create job with command format "comment-{stage}"
        return await tx.job.create({
          data: {
            ticketId,
            projectId,
            command: `comment-${fullTicket.stage.toLowerCase()}`,
            status: 'PENDING',
            branch: fullTicket.branch,
            startedAt: new Date(),
            updatedAt: new Date(),
          },
        });
      });

      jobId = job.id;

      // Dispatch AI-BOARD workflow (async, non-blocking)
      try {
        await dispatchAIBoardWorkflow({
          ticket_id: fullTicket.id.toString(),
          ticketTitle: fullTicket.title,
          stage: fullTicket.stage.toLowerCase(),
          branch: fullTicket.branch || '',
          user: comment.user.name || userId, // Use name or fallback to userId
          comment: content,
          job_id: job.id.toString(),
          project_id: projectId.toString(),
        });
      } catch (workflowError) {
        console.error(
          '[comments] Failed to dispatch AI-BOARD workflow:',
          workflowError
        );
        // Don't fail comment creation if workflow dispatch fails
        // Job will remain in PENDING state and can be retried
      }
    }

    // Transform to API response format
    const response = {
      id: comment.id,
      ticketId: comment.ticketId,
      userId: comment.userId,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      user: {
        name: comment.user.name,
        image: comment.user.image,
      },
      jobId, // Include job ID if AI-BOARD workflow was dispatched
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating comment:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized: Please sign in' }, { status: 401 });
      }
      if (error.message === 'Forbidden') {
        return NextResponse.json(
          { error: 'Forbidden: You do not have access to this project' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
