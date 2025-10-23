import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import {
  aiBoardCommentRequestSchema,
  type AIBoardCommentResponse,
} from '@/app/lib/schemas/ai-board-comment';
import { verifyWorkflowToken } from '@/app/lib/auth/workflow-auth';
import { getAIBoardUserId } from '@/app/lib/db/ai-board-user';

/**
 * Schema for route parameters
 */
const RouteParamsSchema = z.object({
  projectId: z.string().regex(/^\d+$/),
  id: z.string().regex(/^\d+$/),
});

/**
 * POST /api/projects/[projectId]/tickets/[id]/comments/ai-board
 * Create AI-BOARD comment (workflow-only endpoint)
 *
 * Authentication: GitHub workflow token (Bearer token)
 * Used by: .github/workflows/ai-board-assist.yml
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse<AIBoardCommentResponse | { error: string }>> {
  try {
    // Verify workflow token authentication
    const isAuthorized = await verifyWorkflowToken(request);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized - invalid or missing workflow token' },
        { status: 401 }
      );
    }

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

    // Parse and validate request body
    const body = await request.json();
    const validationResult = aiBoardCommentRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { content, userId } = validationResult.data;

    // Verify userId is AI-BOARD user
    const aiBoardUserId = await getAIBoardUserId();
    if (userId !== aiBoardUserId) {
      return NextResponse.json(
        { error: 'Forbidden - only AI-BOARD user can post via this endpoint' },
        { status: 403 }
      );
    }

    // Verify ticket exists and belongs to project
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        projectId: projectId,
      },
      select: { id: true },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found or does not belong to this project' },
        { status: 404 }
      );
    }

    // Create comment with AI-BOARD authorship
    const comment = await prisma.comment.create({
      data: {
        ticketId,
        userId: aiBoardUserId,
        content,
        updatedAt: new Date(),
      },
    });

    console.log(
      `[ai-board-comment] Created comment ${comment.id} for ticket ${ticketId} by AI-BOARD`
    );

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error('[ai-board-comment] Error creating comment:', error);

    // Handle specific errors
    if (
      error instanceof Error &&
      error.message.includes('AI-BOARD user not found')
    ) {
      return NextResponse.json(
        { error: 'AI-BOARD user not configured - run seed script' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
