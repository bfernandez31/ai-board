import { NextRequest, NextResponse } from 'next/server';
import { Prisma, type Agent } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { verifyTicketAccess, verifyProjectAccess } from '@/lib/db/auth-helpers';
import { requireAuth } from '@/lib/db/users';
import { extractStackContext } from '@/lib/analysis/stack-extract';
import { selectAnchors } from '@/lib/analysis/anchor-retrieval';
import { insertRunningAnalysis } from '@/lib/analysis/persist';
import { dispatchInboxAnalysisWorkflow } from '@/lib/analysis/dispatch-analysis';
import { serializeAnalysisRow } from '@/lib/analysis/serialize';
import { estimateAnalysisCostUsd } from '@/lib/analysis/cost-table';
import { getOwnerCredential, getMissingCredentialError } from '@/lib/ai-credentials/workflow';
import type { ProjectConfig } from '@/lib/validations/config';

export const dynamic = 'force-dynamic';

const RATE_LIMIT_PER_HOUR = 10;
const ONE_HOUR_MS = 60 * 60 * 1000;

function noStore(json: unknown, init: ResponseInit = {}): NextResponse {
  const res = NextResponse.json(json, init);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

interface RouteParams {
  params: Promise<{ projectId: string; id: string }>;
}

function parseIds(params: { projectId: string; id: string }) {
  const projectId = parseInt(params.projectId, 10);
  const ticketId = parseInt(params.id, 10);
  if (isNaN(projectId) || projectId <= 0 || isNaN(ticketId) || ticketId <= 0) {
    return null;
  }
  return { projectId, ticketId };
}

async function rateLimitWindow(userId: string) {
  const cutoff = new Date(Date.now() - ONE_HOUR_MS);
  const rows = await prisma.ticketAnalysis.findMany({
    where: {
      userId,
      status: { in: ['success', 'cold_start'] },
      endedAt: { gt: cutoff },
    },
    orderBy: { endedAt: 'asc' },
    select: { endedAt: true },
  });
  const used = rows.length;
  const remaining = Math.max(0, RATE_LIMIT_PER_HOUR - used);
  let nextResetAt: string | null = null;
  const oldest = rows[0]?.endedAt;
  if (used > 0 && oldest) {
    nextResetAt = new Date(oldest.getTime() + ONE_HOUR_MS).toISOString();
  }
  return { used, remaining, nextResetAt };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const ids = parseIds(await params);
    if (!ids) return noStore({ error: 'Invalid ID', code: 'VALIDATION_ERROR' }, { status: 400 });

    await verifyProjectAccess(ids.projectId, request);
    const ticket = await verifyTicketAccess(ids.ticketId, request);
    const userId = await requireAuth(request);

    const latest = await prisma.ticketAnalysis.findFirst({
      where: { ticketId: ids.ticketId },
      orderBy: { createdAt: 'desc' },
    });

    const project = await prisma.project.findUnique({
      where: { id: ids.projectId },
      select: { config: true, defaultAgent: true, specifyModel: true },
    });
    const config = (project?.config as unknown as ProjectConfig | null) ?? null;
    const stack = extractStackContext(config);
    const agent: Agent = project?.defaultAgent ?? 'CLAUDE';
    const cost = estimateAnalysisCostUsd(agent, stack.agent.model);
    const window = await rateLimitWindow(userId);

    const serialized = latest
      ? await serializeAnalysisRow(latest, { userId }, { title: ticket.title, description: ticket.description ?? '' })
      : null;

    return noStore({
      latest: serialized,
      eligibility: {
        triggerable: ticket.stage === 'INBOX',
        estimatedCostUsd: { lower: cost.lowerUsd, upper: cost.upperUsd },
        rateLimit: {
          limitPerHour: RATE_LIMIT_PER_HOUR,
          remaining: window.remaining,
          nextResetAt: window.nextResetAt,
        },
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') return noStore({ error: 'Unauthorized', code: 'UNAUTHENTICATED' }, { status: 401 });
      if (error.message === 'Project not found' || error.message === 'Ticket not found') {
        return noStore({ error: 'Not found', code: 'TICKET_NOT_FOUND' }, { status: 404 });
      }
    }
    console.error('[api/analysis] GET error:', error);
    return noStore({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const ids = parseIds(await params);
    if (!ids) return noStore({ error: 'Invalid ID', code: 'VALIDATION_ERROR' }, { status: 400 });

    await verifyProjectAccess(ids.projectId, request);
    const ticket = await verifyTicketAccess(ids.ticketId, request);
    const userId = await requireAuth(request);

    if (ticket.stage !== 'INBOX') {
      return noStore(
        { error: 'Analysis is only available on INBOX-stage tickets', code: 'STAGE_NOT_INBOX' },
        { status: 422 }
      );
    }

    const window = await rateLimitWindow(userId);
    if (window.remaining <= 0 && window.nextResetAt) {
      const resetTime = new Date(window.nextResetAt).toISOString();
      return noStore(
        {
          error: `Hourly analysis budget exhausted. Capacity returns at ${resetTime}.`,
          code: 'RATE_LIMIT_EXCEEDED',
          nextResetAt: resetTime,
        },
        { status: 429 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: ids.projectId },
      select: {
        id: true,
        githubOwner: true,
        githubRepo: true,
        configSyncedAt: true,
        config: true,
        defaultAgent: true,
        specifyModel: true,
        userId: true,
      },
    });
    if (!project) {
      return noStore({ error: 'Not found', code: 'TICKET_NOT_FOUND' }, { status: 404 });
    }

    const config = (project.config as unknown as ProjectConfig | null) ?? null;
    const stack = extractStackContext(config);
    const agent: Agent = project.defaultAgent;

    const credential = await getOwnerCredential(ids.projectId, 'ANTHROPIC');
    if (!credential) {
      return noStore(
        { error: getMissingCredentialError('ANTHROPIC'), code: 'CREDENTIAL_MISSING' },
        { status: 412 }
      );
    }

    const candidateDomains = await prisma.ticketOutcome
      .findMany({
        where: { projectId: ids.projectId, partial: false },
        select: { domains: true },
        take: 200,
      })
      .then((rows) => Array.from(new Set(rows.flatMap((r) => r.domains ?? []))));

    const anchors = await selectAnchors(ids.projectId, candidateDomains);

    const row = await insertRunningAnalysis({
      ticketId: ids.ticketId,
      projectId: ids.projectId,
      userId,
      agent,
      modelId: stack.agent.model,
      titleSnapshot: ticket.title,
      descriptionSnapshot: ticket.description ?? '',
      stackSnapshot: stack,
      anchorIdsAttempted: anchors.candidateTicketIds,
    });

    try {
      await dispatchInboxAnalysisWorkflow({
        analysis_id: String(row.id),
        project_id: String(ids.projectId),
        ticket_id: String(ids.ticketId),
        githubRepository: `${project.githubOwner}/${project.githubRepo}`,
        agent,
        model: stack.agent.model ?? '',
      });
    } catch (dispatchError) {
      await prisma.ticketAnalysis.update({
        where: { id: row.id },
        data: {
          status: 'failed',
          errorReason: 'dispatch_failed',
          errorMessage:
            dispatchError instanceof Error ? dispatchError.message.slice(0, 2000) : 'dispatch failed',
          endedAt: new Date(),
        },
      });
      console.error('[api/analysis] dispatch failed', dispatchError);
      return noStore(
        { error: 'Failed to dispatch analysis workflow', code: 'INTERNAL_ERROR' },
        { status: 500 }
      );
    }

    console.log(`[api/analysis] POST → analysisId=${row.id} userId=${userId} ticketId=${ids.ticketId}`);

    return noStore(
      {
        analysis: {
          id: row.id,
          status: row.status,
          startedAt: row.startedAt.toISOString(),
        },
      },
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') return noStore({ error: 'Unauthorized', code: 'UNAUTHENTICATED' }, { status: 401 });
      if (error.message === 'Project not found' || error.message === 'Ticket not found') {
        return noStore({ error: 'Not found', code: 'TICKET_NOT_FOUND' }, { status: 404 });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return noStore({ error: 'Conflict', code: 'CONFLICT' }, { status: 409 });
      }
    }
    console.error('[api/analysis] POST error:', error);
    return noStore({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
