import { NextRequest, NextResponse } from 'next/server';
import { ProjectIdSchema } from '@/lib/validations/ticket';
import { getProjectById } from '@/lib/db/projects';
import { prisma } from '@/lib/db/client';
import { parseReportFilename } from '@/lib/comparison/comparison-generator';
import { buildComparisonDetail, comparisonWithEntriesInclude } from '@/lib/comparison/view-model';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string; filename: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdString, filename } = params;

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

    if (!parseReportFilename(filename)) {
      return NextResponse.json(
        {
          error: 'Invalid filename format',
          code: 'VALIDATION_ERROR',
          message: 'Expected format: YYYYMMDD-HHMMSS-vs-KEYS.md',
        },
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

    const comparison = await prisma.ticketComparison.findFirst({
      where: {
        projectId,
        reportFilename: filename,
        tickets: {
          some: { ticketId },
        },
      },
      include: comparisonWithEntriesInclude,
    });

    if (!comparison) {
      return NextResponse.json(
        {
          error: 'Comparison report not found',
          code: 'REPORT_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      comparison: buildComparisonDetail(comparison),
    });
  } catch (error) {
    console.error('Error fetching comparison report:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
