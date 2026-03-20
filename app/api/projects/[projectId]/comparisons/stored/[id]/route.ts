/**
 * Stored Comparison Detail API Route
 *
 * GET /api/projects/:projectId/comparisons/stored/:id
 * Returns a single comparison enriched with ticket metadata, telemetry, and quality scores.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import type { EnrichedComparisonEntry } from '@/lib/types/stored-comparison';

interface RouteParams {
  params: Promise<{ projectId: string; id: string }>;
}

/**
 * GET - Retrieve enriched comparison by ID
 */
export async function GET(
  _request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const { projectId, id } = await context.params;
    const projectIdNum = parseInt(projectId, 10);
    const comparisonId = parseInt(id, 10);

    if (isNaN(projectIdNum) || isNaN(comparisonId)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    try {
      await verifyProjectAccess(projectIdNum);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const comparison = await prisma.ticketComparison.findFirst({
      where: { id: comparisonId, projectId: projectIdNum },
      include: { entries: { orderBy: { rank: 'asc' } } },
    });

    if (!comparison) {
      return NextResponse.json({ error: 'Comparison not found' }, { status: 404 });
    }

    // Get all ticket keys referenced in the comparison
    const ticketKeys = comparison.entries.map((e) => e.ticketKey);

    // Fetch ticket metadata and latest job telemetry in parallel
    const tickets = await prisma.ticket.findMany({
      where: { ticketKey: { in: ticketKeys }, projectId: projectIdNum },
      select: {
        ticketKey: true,
        title: true,
        stage: true,
        workflowType: true,
        agent: true,
        jobs: {
          where: { status: 'COMPLETED' },
          orderBy: { completedAt: 'desc' },
          select: {
            qualityScore: true,
            costUsd: true,
            durationMs: true,
            inputTokens: true,
            outputTokens: true,
          },
        },
      },
    });

    // Build ticket lookup map
    const ticketMap = new Map(tickets.map((t) => [t.ticketKey, t]));

    // Enrich entries with ticket data
    const enrichedEntries: EnrichedComparisonEntry[] = comparison.entries.map((entry) => {
      const ticket = ticketMap.get(entry.ticketKey);

      // Aggregate telemetry across all completed jobs
      let totalCost = 0;
      let totalDuration = 0;
      let totalInput = 0;
      let totalOutput = 0;
      let qualityScore: number | null = null;

      if (ticket?.jobs) {
        for (const job of ticket.jobs) {
          totalCost += job.costUsd ?? 0;
          totalDuration += job.durationMs ?? 0;
          totalInput += job.inputTokens ?? 0;
          totalOutput += job.outputTokens ?? 0;
          // Use the latest quality score (first job since ordered by desc)
          if (qualityScore === null && job.qualityScore != null) {
            qualityScore = job.qualityScore;
          }
        }
      }

      const hasJobs = !!ticket?.jobs?.length;

      return {
        ...entry,
        compliancePrinciples: entry.compliancePrinciples
          ? JSON.parse(entry.compliancePrinciples)
          : null,
        decisionPoints: entry.decisionPoints
          ? JSON.parse(entry.decisionPoints)
          : null,
        title: ticket?.title ?? null,
        stage: ticket?.stage ?? null,
        workflowType: ticket?.workflowType ?? null,
        agent: ticket?.agent ?? null,
        qualityScore,
        costUsd: hasJobs ? totalCost : null,
        durationMs: hasJobs ? totalDuration : null,
        inputTokens: hasJobs ? totalInput : null,
        outputTokens: hasJobs ? totalOutput : null,
      };
    });

    return NextResponse.json({
      id: comparison.id,
      projectId: comparison.projectId,
      sourceTicketKey: comparison.sourceTicketKey,
      recommendation: comparison.recommendation,
      winnerTicketKey: comparison.winnerTicketKey,
      createdAt: comparison.createdAt.toISOString(),
      entries: enrichedEntries,
    });
  } catch (error) {
    console.error('Error fetching enriched comparison:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
