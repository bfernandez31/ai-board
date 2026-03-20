import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getProjectById } from '@/lib/db/projects';
import { ProjectIdSchema } from '@/lib/validations/ticket';

interface ComparisonRouteParams {
  projectId: number;
  ticketId: number;
}

function validationError(message: string): NextResponse {
  return NextResponse.json(
    { error: message, code: 'VALIDATION_ERROR' },
    { status: 400 }
  );
}

async function findProjectTicket(
  projectId: number,
  ticketId: number
): Promise<{ id: number } | null> {
  return prisma.ticket.findFirst({
    where: {
      id: ticketId,
      projectId,
    },
    select: {
      id: true,
    },
  });
}

async function buildMissingTicketResponse(ticketId: number): Promise<NextResponse> {
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

export async function resolveComparisonRouteParams(
  rawProjectId: string,
  rawTicketId: string
): Promise<ComparisonRouteParams | NextResponse> {
  const projectIdResult = ProjectIdSchema.safeParse(rawProjectId);
  if (!projectIdResult.success) {
    return validationError('Invalid project ID');
  }

  const ticketId = Number.parseInt(rawTicketId, 10);
  if (Number.isNaN(ticketId)) {
    return validationError('Invalid ticket ID');
  }

  const projectId = Number.parseInt(projectIdResult.data, 10);
  const project = await getProjectById(projectId);
  if (!project) {
    return NextResponse.json(
      { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
      { status: 404 }
    );
  }

  const ticket = await findProjectTicket(projectId, ticketId);
  if (!ticket) {
    return buildMissingTicketResponse(ticketId);
  }

  return {
    projectId,
    ticketId,
  };
}
