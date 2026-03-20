import { NextRequest, NextResponse } from 'next/server';
import { ProjectIdSchema } from '@/lib/validations/ticket';
import { getProjectById } from '@/lib/db/projects';
import { prisma } from '@/lib/db/client';
import { buildComparisonSummary, comparisonWithEntriesInclude } from '@/lib/comparison/view-model';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdString } = params;

    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      return NextResponse.json(
        { error: 'Invalid project ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const projectId = parseInt(projectIdString, 10);
    const ticketId = parseInt(ticketIdString, 10);
    if (isNaN(ticketId)) {
      return NextResponse.json(
        { error: 'Invalid ticket ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
        { status: 404 }
      );
    }

    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        projectId,
      },
      select: {
        id: true,
      },
    });

    if (!ticket) {
      const ticketExists = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true },
      });

      if (ticketExists) {
        return NextResponse.json(
          { error: 'Forbidden', code: 'WRONG_PROJECT' },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
        { status: 404 }
      );
    }

    const limitParam = request.nextUrl.searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 10;

    const [comparisons, total] = await Promise.all([
      prisma.ticketComparison.findMany({
        where: {
          projectId,
          tickets: {
            some: { ticketId },
          },
        },
        include: comparisonWithEntriesInclude,
        orderBy: { generatedAt: 'desc' },
        take: limit,
      }),
      prisma.ticketComparison.count({
        where: {
          projectId,
          tickets: {
            some: { ticketId },
          },
        },
      }),
    ]);

    return NextResponse.json({
      comparisons: comparisons.map((comparison) =>
        buildComparisonSummary(comparison, ticketId)
      ),
      total,
      limit,
      offset: 0,
    });
  } catch (error) {
    console.error('Error listing comparisons:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
