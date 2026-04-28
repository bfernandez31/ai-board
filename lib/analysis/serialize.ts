import type { TicketAnalysis } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { AnalysisOutputSchema, ColdStartOutputSchema, type AnchorCitation } from './output-schema';
import type { StackContext } from './types';
import { isStale } from './stale-check';

export interface SerializedAnchor extends AnchorCitation {
  tombstoned: boolean;
}

export interface SerializedAnalysisDTO {
  id: number;
  ticketId: number;
  projectId: number;
  userId: string;
  status: TicketAnalysis['status'];
  ruleSetVersion: number;
  agent: TicketAnalysis['agent'];
  modelId: string | null;
  startedAt: string;
  endedAt: string | null;
  titleSnapshot: string;
  descriptionSnapshot: string;
  stackSnapshot: StackContext | null;
  telemetry: {
    costUsd: number | null;
    durationMs: number | null;
    inputTokens: number | null;
    outputTokens: number | null;
    thinkingTokens: number | null;
    cacheReadTokens: number | null;
  };
  coldStartReason: string | null;
  errorReason: string | null;
  errorMessage: string | null;
  output:
    | (Omit<ReturnType<typeof AnalysisOutputSchema.parse>, 'anchors'> & {
        anchors: SerializedAnchor[];
      })
    | { scopeWarnings: ReturnType<typeof ColdStartOutputSchema.parse>['scopeWarnings'] }
    | null;
  stale: boolean;
}

export interface ViewerContext {
  userId: string;
}

interface CurrentTicketLike {
  title: string;
  description: string;
}

async function filterAnchorsByAccess(
  anchors: AnchorCitation[],
  viewerUserId: string
): Promise<SerializedAnchor[]> {
  if (anchors.length === 0) return [];

  const ticketIds = anchors.map((a) => a.ticketId);
  const tickets = await prisma.ticket.findMany({
    where: { id: { in: ticketIds } },
    select: {
      id: true,
      project: {
        select: {
          userId: true,
          members: {
            where: { userId: viewerUserId },
            select: { userId: true },
          },
        },
      },
    },
  });

  const existingSet = new Set(tickets.map((t) => t.id));
  const accessibleSet = new Set(
    tickets
      .filter(
        (t) => t.project.userId === viewerUserId || t.project.members.length > 0
      )
      .map((t) => t.id)
  );

  const result: SerializedAnchor[] = [];
  for (const a of anchors) {
    if (!existingSet.has(a.ticketId)) {
      result.push({ ...a, tombstoned: true });
      continue;
    }
    if (accessibleSet.has(a.ticketId)) {
      result.push({ ...a, tombstoned: false });
    }
  }
  return result;
}

export async function serializeAnalysisRow(
  row: TicketAnalysis,
  viewer: ViewerContext,
  currentTicket?: CurrentTicketLike
): Promise<SerializedAnalysisDTO> {
  let outputDto: SerializedAnalysisDTO['output'] = null;

  if (row.status === 'success' && row.output) {
    const parsed = AnalysisOutputSchema.parse(row.output);
    const filteredAnchors = await filterAnchorsByAccess(parsed.anchors, viewer.userId);
    outputDto = { ...parsed, anchors: filteredAnchors };
  } else if (row.status === 'cold_start' && row.output) {
    outputDto = ColdStartOutputSchema.parse(row.output);
  }

  const stale = currentTicket
    ? isStale(currentTicket, {
        titleSnapshot: row.titleSnapshot,
        descriptionSnapshot: row.descriptionSnapshot,
      })
    : false;

  return {
    id: row.id,
    ticketId: row.ticketId,
    projectId: row.projectId,
    userId: row.userId,
    status: row.status,
    ruleSetVersion: row.ruleSetVersion,
    agent: row.agent,
    modelId: row.modelId,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    titleSnapshot: row.titleSnapshot,
    descriptionSnapshot: row.descriptionSnapshot,
    stackSnapshot: (row.stackSnapshot as unknown as StackContext) ?? null,
    telemetry: {
      costUsd: row.costUsd,
      durationMs: row.durationMs,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      thinkingTokens: row.thinkingTokens,
      cacheReadTokens: row.cacheReadTokens,
    },
    coldStartReason: row.coldStartReason,
    errorReason: row.errorReason,
    errorMessage: row.errorMessage,
    output: outputDto,
    stale,
  };
}
