import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';
import type { StackContext } from '@/lib/analysis/types';

export const dynamic = 'force-dynamic';

function noStore(json: unknown, init: ResponseInit = {}): NextResponse {
  const res = NextResponse.json(json, init);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function GET(request: NextRequest) {
  const auth = validateWorkflowAuth(request);
  if (!auth.isValid) {
    return noStore({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const analysisIdStr = url.searchParams.get('analysisId');
  const analysisId = analysisIdStr ? parseInt(analysisIdStr, 10) : NaN;
  if (isNaN(analysisId) || analysisId <= 0) {
    return noStore({ error: 'Invalid analysisId' }, { status: 400 });
  }

  const row = await prisma.ticketAnalysis.findUnique({ where: { id: analysisId } });
  if (!row) {
    return noStore({ error: 'Analysis not found' }, { status: 404 });
  }

  if (row.status !== 'running') {
    return noStore({ error: 'Analysis is no longer running' }, { status: 410 });
  }

  const candidates = await prisma.ticketOutcome.findMany({
    where: { ticketId: { in: row.anchorIdsAttempted } },
    include: { ticket: { select: { ticketKey: true } } },
  });

  return noStore({
    ticket: {
      id: row.ticketId,
      title: row.titleSnapshot,
      description: row.descriptionSnapshot,
    },
    stack: row.stackSnapshot as unknown as StackContext,
    candidates: candidates.map((c) => ({
      outcomeId: c.id,
      ticketId: c.ticketId,
      ticketKey: c.ticket.ticketKey,
      domains: c.domains,
      frictionFree: c.frictionFree,
      qualityScore: c.qualityScore,
      touchedDbSchema: c.touchedDbSchema,
      touchedTests: c.touchedTests,
      touchedCi: c.touchedCi,
      shippedAt: c.shippedAt.toISOString(),
      totalCostUsd: c.totalCostUsd,
      totalDurationMs: c.totalDurationMs,
    })),
    ruleSetVersion: row.ruleSetVersion,
  });
}
