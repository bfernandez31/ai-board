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

type RouteParams = { projectId: string };

function jsonError(status: number, error: string, code: string): NextResponse {
  return NextResponse.json({ error, code }, { status });
}

async function parseProjectParams(
  context: { params: Promise<RouteParams> }
): Promise<{ projectId: number } | null> {
  const paramsResult = paramsSchema.safeParse(await context.params);
  if (!paramsResult.success) {
    return null;
  }

  return { projectId: paramsResult.data.projectId };
}

function getUniqueTicketIds(ticketIds: number[]): number[] | null {
  const uniqueTicketIds = [...new Set(ticketIds)];
  if (uniqueTicketIds.length < 2 || uniqueTicketIds.length !== ticketIds.length) {
    return null;
  }

  return uniqueTicketIds;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
): Promise<NextResponse> {
  try {
    const params = await parseProjectParams(context);
    if (!params) {
      return jsonError(400, 'Invalid project ID', 'VALIDATION_ERROR');
    }

    const bodyResult = requestSchema.safeParse(await request.json());
    if (!bodyResult.success) {
      return jsonError(400, 'Invalid launch payload', 'VALIDATION_ERROR');
    }

    const projectId = params.projectId;
    await verifyProjectAccess(projectId, request);
    const userId = await requireAuth(request);

    const uniqueTicketIds = getUniqueTicketIds(bodyResult.data.ticketIds);
    if (!uniqueTicketIds) {
      return jsonError(400, 'Select 2 to 5 unique VERIFY tickets', 'VALIDATION_ERROR');
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
      return jsonError(
        404,
        'One or more tickets were not found in this project',
        'TICKET_NOT_FOUND'
      );
    }

    const invalidStageTicket = selectedTickets.find((ticket) => ticket.stage !== 'VERIFY');
    if (invalidStageTicket) {
      return jsonError(
        409,
        `Only VERIFY tickets can be compared from the hub (${invalidStageTicket.ticketKey} is ${invalidStageTicket.stage})`,
        'INVALID_STAGE'
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
        userName: user?.name ?? userId,
        selectedTickets,
      });

      return NextResponse.json(launch, { status: 202 });
    } catch (error) {
      if (error instanceof Error && error.message === 'ACTIVE_JOB_EXISTS') {
        return jsonError(
          409,
          'A selected source ticket already has an active AI-BOARD job',
          'ACTIVE_JOB_EXISTS'
        );
      }

      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Project not found') {
      return jsonError(404, 'Project not found', 'PROJECT_NOT_FOUND');
    }

    if (error instanceof Error && error.message === 'Unauthorized') {
      return jsonError(401, 'Unauthorized', 'AUTH_REQUIRED');
    }

    return jsonError(500, 'Internal server error', 'INTERNAL_ERROR');
  }
}
