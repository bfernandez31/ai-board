import type { Agent, Stage, WorkflowType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { verifyWorkflowToken } from '@/app/lib/auth/workflow-auth';
import { prisma } from '@/lib/db/client';
import { persistComparisonRecord } from '@/lib/comparison/comparison-record';
import { normalizeComparisonPersistenceRequest } from '@/lib/comparison/comparison-payload';
import { verifyTicketAccess } from '@/lib/db/auth-helpers';
import { listTicketComparisons } from '@/lib/comparison/comparison-detail';

const paramsSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  id: z.coerce.number().int().positive(),
});

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(10),
});

type RouteParams = { projectId: string; id: string };

type ParticipantRecord = {
  id: number;
  ticketKey: string;
  title: string;
  stage: Stage;
  workflowType: WorkflowType;
  agent: Agent | null;
};

function jsonError(status: number, error: string, code: string): NextResponse {
  return NextResponse.json({ error, code }, { status });
}

async function parseRouteParams(
  context: { params: Promise<RouteParams> }
): Promise<{ projectId: number; ticketId: number } | null> {
  const paramsResult = paramsSchema.safeParse(await context.params);
  if (!paramsResult.success) {
    return null;
  }

  return {
    projectId: paramsResult.data.projectId,
    ticketId: paramsResult.data.id,
  };
}

function orderParticipantsByPayload(
  participants: ParticipantRecord[],
  participantTicketIds: number[]
): ParticipantRecord[] | null {
  const participantById = new Map(
    participants.map((participant) => [participant.id, participant] as const)
  );
  const orderedParticipants: ParticipantRecord[] = [];

  for (const participantId of participantTicketIds) {
    const participant = participantById.get(participantId);
    if (!participant) {
      return null;
    }

    orderedParticipants.push(participant);
  }

  return orderedParticipants;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
): Promise<NextResponse> {
  try {
    const params = await parseRouteParams(context);
    if (!params) {
      return jsonError(400, 'Invalid project or ticket ID', 'VALIDATION_ERROR');
    }

    const { projectId, ticketId } = params;
    const queryResult = querySchema.safeParse({
      limit: request.nextUrl.searchParams.get('limit') ?? undefined,
    });

    if (!queryResult.success) {
      return jsonError(400, 'Invalid query parameters', 'VALIDATION_ERROR');
    }

    const ticket = await verifyTicketAccess(ticketId, request);
    if (ticket.projectId !== projectId) {
      return jsonError(403, 'Forbidden', 'WRONG_PROJECT');
    }

    const result = await listTicketComparisons(ticketId, queryResult.data.limit);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Ticket not found') {
      return jsonError(404, 'Ticket not found', 'TICKET_NOT_FOUND');
    }

    return jsonError(500, 'Internal server error', 'INTERNAL_ERROR');
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
): Promise<NextResponse> {
  try {
    const isAuthorized = await verifyWorkflowToken(request);
    if (!isAuthorized) {
      return jsonError(401, 'Unauthorized: Invalid workflow token', 'UNAUTHORIZED');
    }

    const params = await parseRouteParams(context);
    if (!params) {
      return jsonError(400, 'Invalid project or ticket ID', 'VALIDATION_ERROR');
    }

    const { projectId, ticketId } = params;
    const payload = normalizeComparisonPersistenceRequest(await request.json());

    if (payload.projectId !== projectId || payload.sourceTicketId !== ticketId) {
      return jsonError(400, 'Payload scope does not match route parameters', 'VALIDATION_ERROR');
    }

    if (payload.report.metadata.sourceTicket !== payload.sourceTicketKey) {
      return jsonError(400, 'Source ticket key does not match report metadata', 'VALIDATION_ERROR');
    }

    if (!payload.markdownPath.endsWith(payload.report.metadata.filePath)) {
      return jsonError(400, 'Markdown path does not match report metadata', 'VALIDATION_ERROR');
    }

    const sourceTicket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        projectId,
      },
      select: {
        id: true,
        ticketKey: true,
        title: true,
        stage: true,
        workflowType: true,
        agent: true,
        branch: true,
      },
    });

    if (!sourceTicket) {
      return jsonError(404, 'Ticket not found for project', 'TICKET_NOT_FOUND');
    }

    const expectedMarkdownPrefix = sourceTicket.branch
      ? `specs/${sourceTicket.branch}/comparisons/`
      : null;

    if (!expectedMarkdownPrefix || !payload.markdownPath.startsWith(expectedMarkdownPrefix)) {
      return jsonError(400, 'Markdown path is outside the source ticket branch scope', 'VALIDATION_ERROR');
    }

    if (sourceTicket.ticketKey !== payload.sourceTicketKey) {
      return jsonError(400, 'Source ticket key does not match source ticket', 'VALIDATION_ERROR');
    }

    const uniqueParticipantIds = [...new Set(payload.participantTicketIds)];
    if (uniqueParticipantIds.length !== payload.participantTicketIds.length) {
      return jsonError(400, 'Participant ticket IDs must be unique', 'VALIDATION_ERROR');
    }

    const participants = await prisma.ticket.findMany({
      where: {
        id: { in: payload.participantTicketIds },
        projectId,
      },
      select: {
        id: true,
        ticketKey: true,
        title: true,
        stage: true,
        workflowType: true,
        agent: true,
      },
    });

    if (participants.length !== payload.participantTicketIds.length) {
      return jsonError(404, 'Participant ticket not found for project', 'PARTICIPANT_NOT_FOUND');
    }

    if (participants.some((participant) => participant.id === sourceTicket.id)) {
      return jsonError(400, 'Source ticket cannot be a comparison participant', 'VALIDATION_ERROR');
    }

    if (payload.report.metadata.comparedTickets.length !== payload.participantTicketIds.length) {
      return jsonError(400, 'Compared ticket count does not match participant IDs', 'VALIDATION_ERROR');
    }

    const orderedParticipants = orderParticipantsByPayload(
      participants,
      payload.participantTicketIds
    );
    if (!orderedParticipants) {
      return jsonError(404, 'Participant ticket not found for project', 'PARTICIPANT_NOT_FOUND');
    }

    const participantKeys = orderedParticipants.map((participant) => participant.ticketKey);
    const reportKeys = payload.report.metadata.comparedTickets;

    if (participantKeys.some((key, index) => key !== reportKeys[index])) {
      return jsonError(400, 'Participant tickets do not match report ordering', 'VALIDATION_ERROR');
    }

    const { record, isDuplicate } = await persistComparisonRecord({
      projectId,
      sourceTicket,
      participants: orderedParticipants,
      compareRunKey: payload.compareRunKey,
      markdownPath: payload.markdownPath,
      report: payload.report,
    });

    return NextResponse.json(
      {
        comparisonId: record.id,
        compareRunKey: payload.compareRunKey,
        status: isDuplicate ? 'duplicate' : 'created',
      },
      { status: isDuplicate ? 200 : 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(400, 'Invalid comparison persistence payload', 'VALIDATION_ERROR');
    }

    console.error('[comparisons-route] Failed to persist comparison payload:', error);
    return jsonError(500, 'Failed to persist comparison payload', 'INTERNAL_ERROR');
  }
}
