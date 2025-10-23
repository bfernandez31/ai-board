import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { createCommentSchema } from '@/app/lib/schemas/comment-validation';
import { requireAuth } from '@/lib/db/users';
import { extractMentionUserIds } from '@/app/lib/utils/mention-parser';

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
