import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import {
  aiBoardCommentRequestSchema,
  type AIBoardCommentResponse,
} from '@/app/lib/schemas/ai-board-comment';
import { verifyWorkflowToken } from '@/app/lib/auth/workflow-auth';
import { getAIBoardUserId } from '@/app/lib/db/ai-board-user';
import { resolveTicket } from '@/app/lib/utils/ticket-resolver';
import { extractMentionUserIds } from '@/app/lib/utils/mention-parser';

/**
 * Schema for route parameters
 * Supports both numeric ID and ticketKey (e.g., "ABC-123")
 */
const RouteParamsSchema = z.object({
  projectId: z.string().regex(/^\d+$/),
  id: z.string().min(1), // Accept both numeric ID and ticketKey
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

    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

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

    // Resolve ticket (supports both numeric ID and ticketKey)
    const ticket = await resolveTicket(projectId, ticketIdString);

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found or does not belong to this project' },
        { status: 404 }
      );
    }

    const ticketId = ticket.id;

    // Create comment with AI-BOARD authorship
    const comment = await prisma.comment.create({
      data: {
        ticketId,
        userId: aiBoardUserId,
        content,
        updatedAt: new Date(),
      },
    });

    // Extract mentions from comment content
    const mentionedUserIds = extractMentionUserIds(content);

    // Create notifications for mentions (non-blocking)
    try {
      if (mentionedUserIds.length > 0) {
        // Get project owner and members
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          include: {
            members: { select: { userId: true } },
          },
        });

        if (project) {
          const projectMemberIds = [
            project.userId, // Owner
            ...project.members.map(m => m.userId), // Members
          ];

          // Filter valid recipients (project members, exclude self)
          const validRecipients = mentionedUserIds.filter(
            id => id !== aiBoardUserId && projectMemberIds.includes(id)
          );

          // Create notifications
          if (validRecipients.length > 0) {
            await prisma.notification.createMany({
              data: validRecipients.map(recipientId => ({
                recipientId,
                actorId: aiBoardUserId,
                commentId: comment.id,
                ticketId,
              })),
            });
          }
        }
      }
    } catch (notificationError) {
      // Log but don't block comment creation
      console.error('[ai-board-comment] Failed to create notifications:', notificationError);
    }

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
