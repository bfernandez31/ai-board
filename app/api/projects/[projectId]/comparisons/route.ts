import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/workflow-auth';
import {
  buildComparisonSummary,
  comparisonIngestSchema,
  comparisonWithEntriesInclude,
} from '@/lib/comparison/view-model';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

const projectIdSchema = z.coerce.number().int().positive();
const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export async function GET(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const { projectId: rawProjectId } = await context.params;
    const projectIdResult = projectIdSchema.safeParse(rawProjectId);
    if (!projectIdResult.success) {
      return NextResponse.json(
        { error: 'Invalid project ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const projectId = projectIdResult.data;

    try {
      await verifyProjectAccess(projectId, request);
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const queryResult = querySchema.safeParse({
      limit: request.nextUrl.searchParams.get('limit') ?? 20,
      offset: request.nextUrl.searchParams.get('offset') ?? 0,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { limit, offset } = queryResult.data;

    const [comparisons, total] = await Promise.all([
      prisma.ticketComparison.findMany({
        where: { projectId },
        include: comparisonWithEntriesInclude,
        orderBy: { generatedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.ticketComparison.count({
        where: { projectId },
      }),
    ]);

    return NextResponse.json({
      comparisons: comparisons.map((comparison) => buildComparisonSummary(comparison)),
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching project comparisons:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const authResult = validateWorkflowAuth(request);
    if (!authResult.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { projectId: rawProjectId } = await context.params;
    const projectIdResult = projectIdSchema.safeParse(rawProjectId);
    if (!projectIdResult.success) {
      return NextResponse.json(
        { error: 'Invalid project ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const parsedPayload = comparisonIngestSchema.safeParse(payload);
    if (!parsedPayload.success) {
      return NextResponse.json(
        {
          error: 'Invalid comparison payload',
          code: 'VALIDATION_ERROR',
          details: parsedPayload.error.flatten(),
        },
        { status: 400 }
      );
    }

    const projectId = projectIdResult.data;
    const data = parsedPayload.data;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
        { status: 404 }
      );
    }

    const tickets = await prisma.ticket.findMany({
      where: {
        id: { in: data.tickets.map((ticket) => ticket.ticketId) },
      },
      select: {
        id: true,
        projectId: true,
      },
    });

    if (tickets.length !== data.tickets.length) {
      return NextResponse.json(
        { error: 'One or more tickets were not found', code: 'TICKET_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (tickets.some((ticket) => ticket.projectId !== projectId)) {
      return NextResponse.json(
        { error: 'All tickets must belong to the same project', code: 'WRONG_PROJECT' },
        { status: 403 }
      );
    }

    const comparison = await prisma.$transaction(async (transaction) => {
      const upserted = await transaction.ticketComparison.upsert({
        where: {
          projectId_reportFilename: {
            projectId,
            reportFilename: data.reportFilename,
          },
        },
        create: {
          projectId,
          sourceTicketId: data.sourceTicketId,
          winnerTicketId: data.winnerTicketId ?? null,
          reportFilename: data.reportFilename,
          reportPath: data.reportPath,
          generatedAt: data.generatedAt ?? new Date(),
          summary: data.summary,
          recommendation: data.recommendation,
          decisionPoints: data.decisionPoints,
        },
        update: {
          sourceTicketId: data.sourceTicketId,
          winnerTicketId: data.winnerTicketId ?? null,
          reportPath: data.reportPath,
          generatedAt: data.generatedAt ?? new Date(),
          summary: data.summary,
          recommendation: data.recommendation,
          decisionPoints: data.decisionPoints,
        },
        select: {
          id: true,
          reportFilename: true,
        },
      });

      await transaction.ticketComparisonEntry.deleteMany({
        where: { comparisonId: upserted.id },
      });

      await transaction.ticketComparisonEntry.createMany({
        data: data.tickets.map((ticket) => ({
          comparisonId: upserted.id,
          ticketId: ticket.ticketId,
          rank: ticket.rank,
          score: ticket.score,
          verdictSummary: ticket.verdictSummary,
          keyDifferentiators: ticket.keyDifferentiators,
          metrics: ticket.metrics,
          constitution: ticket.constitution,
        })),
      });

      return upserted;
    });

    return NextResponse.json(
      {
        id: comparison.id,
        filename: comparison.reportFilename,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error storing comparison:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
