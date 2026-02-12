import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { verifyTicketAccess } from '@/lib/db/auth-helpers';
import { createCommentSchema } from '@/app/lib/schemas/comment-validation';
import { requireAuth } from '@/lib/db/users';
import { extractMentionUserIds } from '@/app/lib/utils/mention-parser';
import { getAIBoardUserId } from '@/app/lib/db/ai-board-user';
import { checkAIBoardAvailability } from '@/app/lib/utils/ai-board-availability';
import { dispatchAIBoardWorkflow } from '@/app/lib/workflows/dispatch-ai-board';
import { sendMentionNotification } from '@/app/lib/push/send-notification';

const RouteParamsSchema = z.object({
  projectId: z.string().regex(/^\d+$/),
  id: z.string().regex(/^\d+$/),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdString } = params;

    const paramsResult = RouteParamsSchema.safeParse({ projectId: projectIdString, id: ticketIdString });
    if (!paramsResult.success) {
      return NextResponse.json({ error: 'Invalid project ID or ticket ID' }, { status: 400 });
    }

    const projectId = parseInt(projectIdString, 10);
    const ticketId = parseInt(ticketIdString, 10);

    const ticket = await verifyTicketAccess(ticketId);
    if (ticket.projectId !== projectId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const currentUserId = await requireAuth();

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

    const allMentionedUserIds = comments.flatMap((comment) => extractMentionUserIds(comment.content));
    const uniqueUserIds = Array.from(new Set(allMentionedUserIds));

    const mentionedUsers = await prisma.user.findMany({
      where: { id: { in: uniqueUserIds } },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    const mentionedUsersMap = Object.fromEntries(
      mentionedUsers.map((user) => [user.id, user])
    );

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
      currentUserId,
    };

    return NextResponse.json(response, {
      headers: {
        'X-Current-User-Id': currentUserId,
        'Access-Control-Expose-Headers': 'X-Current-User-Id',
      },
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized: Please sign in' }, { status: 401 });
      if (error.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden: You do not have access to this project' }, { status: 403 });
      if (error.message === 'Ticket not found' || error.message === 'Project not found') return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdString } = params;

    const paramsResult = RouteParamsSchema.safeParse({ projectId: projectIdString, id: ticketIdString });
    if (!paramsResult.success) {
      return NextResponse.json({ error: 'Invalid project ID or ticket ID' }, { status: 400 });
    }

    const projectId = parseInt(projectIdString, 10);
    const ticketId = parseInt(ticketIdString, 10);

    const ticket = await verifyTicketAccess(ticketId);
    if (ticket.projectId !== projectId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userId = await requireAuth();

    const body = await request.json();
    const validationResult = createCommentSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Validation failed', issues: validationResult.error.issues }, { status: 400 });
    }

    const { content } = validationResult.data;

    const mentionedUserIds = extractMentionUserIds(content);

    if (mentionedUserIds.length > 0) {
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

    const aiBoardUserId = await getAIBoardUserId();
    const aiBoardMentioned = mentionedUserIds.includes(aiBoardUserId);

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
          const projectMemberIds = [project.userId, ...project.members.map(m => m.userId)];
          const validRecipients = mentionedUserIds.filter(
            id => id !== userId && projectMemberIds.includes(id)
          );

          if (validRecipients.length > 0) {
            await prisma.notification.createMany({
              data: validRecipients.map(recipientId => ({
                recipientId,
                actorId: userId,
                commentId: comment.id,
                ticketId,
              })),
            });

            const actorName = comment.user.name || 'Someone';
            for (const recipientId of validRecipients) {
              sendMentionNotification(
                recipientId,
                actorName,
                ticket.ticketKey,
                projectId
              ).catch((err) => {
                console.error('[comments] Push notification error:', err);
              });
            }
          }
        }
      }
    } catch (notificationError) {
      console.error('[comments] Failed to create notifications:', notificationError);
    }

    let jobId: number | undefined;

    if (aiBoardMentioned) {
      const availability = await checkAIBoardAvailability(ticketId);
      if (!availability.available) {
        return NextResponse.json(
          {
            error: `AI-BOARD is not available: ${availability.reason}`,
            code: 'AI_BOARD_UNAVAILABLE',
          },
          { status: 400 }
        );
      }

      const fullTicket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: {
          id: true,
          title: true,
          stage: true,
          branch: true,
          project: {
            select: {
              githubOwner: true,
              githubRepo: true,
            },
          },
        },
      });

      if (!fullTicket) {
        return NextResponse.json(
          { error: 'Ticket not found' },
          { status: 404 }
        );
      }

      const job = await prisma.$transaction(async (tx) => {
        const existingJob = await tx.job.findFirst({
          where: {
            ticketId,
            status: { in: ['PENDING', 'RUNNING'] },
          },
        });

        if (existingJob) {
          throw new Error('AI-BOARD already processing this ticket');
        }

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

      try {
        await dispatchAIBoardWorkflow({
          ticket_id: fullTicket.id.toString(),
          stage: fullTicket.stage.toLowerCase(),
          branch: fullTicket.branch || '',
          user_id: userId, // User ID for notification mentions
          user: comment.user.name || userId,
          comment: content,
          job_id: job.id.toString(),
          project_id: projectId.toString(),
          githubRepository: `${fullTicket.project.githubOwner}/${fullTicket.project.githubRepo}`,
        });
      } catch (workflowError) {
        console.error('[comments] Failed to dispatch AI-BOARD workflow:', workflowError);
      }
    }

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
      jobId,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating comment:', error);
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized: Please sign in' }, { status: 401 });
      if (error.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden: You do not have access to this project' }, { status: 403 });
      if (error.message === 'Ticket not found' || error.message === 'Project not found') return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
