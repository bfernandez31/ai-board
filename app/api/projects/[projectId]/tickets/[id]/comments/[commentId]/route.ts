import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { requireAuth } from '@/lib/db/users';

/**
 * Schema for route parameters
 */
const RouteParamsSchema = z.object({
  projectId: z.string().regex(/^\d+$/),
  id: z.string().regex(/^\d+$/),
  commentId: z.string().regex(/^\d+$/),
});

/**
 * DELETE /api/projects/[projectId]/tickets/[id]/comments/[commentId]
 * Delete a comment (requires authorship validation)
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string; commentId: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdString, commentId: commentIdString } = params;

    // Validate route params
    const paramsResult = RouteParamsSchema.safeParse({
      projectId: projectIdString,
      id: ticketIdString,
      commentId: commentIdString,
    });

    if (!paramsResult.success) {
      return NextResponse.json(
        { error: 'Invalid project ID, ticket ID, or comment ID' },
        { status: 400 }
      );
    }

    const projectId = parseInt(projectIdString, 10);
    const ticketId = parseInt(ticketIdString, 10);
    const commentId = parseInt(commentIdString, 10);

    // Verify project ownership (throws if unauthorized or not found)
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

    // Fetch comment and validate authorship
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        userId: true,
        ticketId: true,
      },
    });

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Verify comment belongs to this ticket
    if (comment.ticketId !== ticketId) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Verify authorship (only author can delete their own comment)
    if (comment.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden: You can only delete your own comments' },
        { status: 403 }
      );
    }

    // Delete comment
    await prisma.comment.delete({
      where: { id: commentId },
    });

    // Return 204 No Content
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting comment:', error);

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
