import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { requireAuth } from '@/lib/db/users';
import { prisma } from '@/lib/db/client';
import { createProjectComparisonLaunch } from '@/lib/comparison/project-comparison-launch';

const paramsSchema = z.object({
  projectId: z.coerce.number().int().positive(),
});

const requestSchema = z.object({
  ticketIds: z.array(z.coerce.number().int().positive()).min(2).max(5),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const paramsResult = paramsSchema.safeParse(await context.params);
    if (!paramsResult.success) {
      return NextResponse.json(
        { error: 'Invalid project ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const bodyResult = requestSchema.safeParse(await request.json());
    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid launch payload', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const projectId = paramsResult.data.projectId;
    await verifyProjectAccess(projectId, request);
    const userId = await requireAuth(request);

    const uniqueTicketIds = [...new Set(bodyResult.data.ticketIds)];
    if (uniqueTicketIds.length < 2 || uniqueTicketIds.length !== bodyResult.data.ticketIds.length) {
      return NextResponse.json(
        { error: 'Select 2 to 5 unique VERIFY tickets', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const selectedTickets = await prisma.ticket.findMany({
      where: {
        id: { in: uniqueTicketIds },
        projectId,
      },
      select: {
        id: true,
        ticketKey: true,
        title: true,
        branch: true,
        projectId: true,
        stage: true,
        agent: true,
        updatedAt: true,
        project: {
          select: {
            githubOwner: true,
            githubRepo: true,
            defaultAgent: true,
          },
        },
      },
    });

    if (selectedTickets.length !== uniqueTicketIds.length) {
      return NextResponse.json(
        { error: 'One or more tickets were not found in this project', code: 'TICKET_NOT_FOUND' },
        { status: 404 }
      );
    }

    const invalidStageTicket = selectedTickets.find((ticket) => ticket.stage !== 'VERIFY');
    if (invalidStageTicket) {
      return NextResponse.json(
        {
          error: `Only VERIFY tickets can be compared from the hub (${invalidStageTicket.ticketKey} is ${invalidStageTicket.stage})`,
          code: 'INVALID_STAGE',
        },
        { status: 409 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    try {
      const launch = await createProjectComparisonLaunch({
        projectId,
        userId,
        userName: user?.name || userId,
        selectedTickets,
      });

      return NextResponse.json(launch, { status: 202 });
    } catch (error) {
      if (error instanceof Error && error.message === 'ACTIVE_JOB_EXISTS') {
        return NextResponse.json(
          { error: 'A selected source ticket already has an active AI-BOARD job', code: 'ACTIVE_JOB_EXISTS' },
          { status: 409 }
        );
      }

      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json(
        { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
