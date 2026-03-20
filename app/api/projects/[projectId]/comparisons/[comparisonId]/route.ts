/**
 * Enriched Comparison Detail API Route
 *
 * GET /api/projects/:projectId/comparisons/:comparisonId
 * Returns full comparison with ticket metadata, telemetry, and quality scores.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';

interface RouteParams {
  params: Promise<{ projectId: string; comparisonId: string }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const { projectId, comparisonId } = await context.params;
    const projectIdNum = parseInt(projectId, 10);
    const comparisonIdNum = parseInt(comparisonId, 10);

    if (isNaN(projectIdNum) || isNaN(comparisonIdNum)) {
      return NextResponse.json(
        { error: 'Invalid project or comparison ID' },
        { status: 400 }
      );
    }

    try {
      await verifyProjectAccess(projectIdNum);
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch comparison with all related data
    const comparison = await prisma.comparison.findFirst({
      where: { id: comparisonIdNum, projectId: projectIdNum },
      include: {
        sourceTicket: { select: { ticketKey: true } },
        entries: {
          orderBy: { rank: 'asc' },
          include: {
            ticket: {
              select: {
                id: true,
                ticketKey: true,
                title: true,
                stage: true,
                workflowType: true,
                branch: true,
              },
            },
          },
        },
        decisionPoints: {
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!comparison) {
      return NextResponse.json(
        { error: 'Comparison not found' },
        { status: 404 }
      );
    }

    // Fetch telemetry and quality scores for each entry's ticket
    const ticketIds = comparison.entries.map((e) => e.ticketId);

    // Aggregate telemetry: sum of costUsd, durationMs, tokens for COMPLETED jobs per ticket
    const telemetryByTicket = new Map<number, {
      totalCostUsd: number;
      totalDurationMs: number;
      totalInputTokens: number;
      totalOutputTokens: number;
      model: string | null;
    }>();

    if (ticketIds.length > 0) {
      const jobs = await prisma.job.findMany({
        where: {
          ticketId: { in: ticketIds },
          status: 'COMPLETED',
        },
        select: {
          ticketId: true,
          costUsd: true,
          durationMs: true,
          inputTokens: true,
          outputTokens: true,
          model: true,
        },
      });

      for (const job of jobs) {
        const existing = telemetryByTicket.get(job.ticketId) ?? {
          totalCostUsd: 0,
          totalDurationMs: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          model: null,
        };
        existing.totalCostUsd += job.costUsd ?? 0;
        existing.totalDurationMs += job.durationMs ?? 0;
        existing.totalInputTokens += job.inputTokens ?? 0;
        existing.totalOutputTokens += job.outputTokens ?? 0;
        if (job.model && !existing.model) {
          existing.model = job.model;
        }
        telemetryByTicket.set(job.ticketId, existing);
      }
    }

    // Quality scores: latest COMPLETED verify job per ticket
    const qualityByTicket = new Map<number, { score: number; details: Record<string, unknown> }>();

    if (ticketIds.length > 0) {
      const verifyJobs = await prisma.job.findMany({
        where: {
          ticketId: { in: ticketIds },
          status: 'COMPLETED',
          command: 'verify',
          qualityScore: { not: null },
        },
        orderBy: { completedAt: 'desc' },
        select: {
          ticketId: true,
          qualityScore: true,
          qualityScoreDetails: true,
        },
      });

      for (const job of verifyJobs) {
        if (!qualityByTicket.has(job.ticketId) && job.qualityScore !== null) {
          let details: Record<string, unknown> = {};
          if (job.qualityScoreDetails) {
            try {
              details = JSON.parse(job.qualityScoreDetails) as Record<string, unknown>;
            } catch {
              // Invalid JSON, use empty details
            }
          }
          qualityByTicket.set(job.ticketId, {
            score: job.qualityScore,
            details,
          });
        }
      }
    }

    // Build enriched response
    const enrichedEntries = comparison.entries.map((entry) => {
      let complianceData: Array<{ name: string; passed: boolean; notes?: string }> = [];
      try {
        const parsed = JSON.parse(entry.complianceData) as { principles?: Array<{ name: string; passed: boolean; notes?: string }> };
        complianceData = parsed.principles ?? [];
      } catch {
        // Invalid JSON
      }

      const telemetry = telemetryByTicket.get(entry.ticketId);
      const quality = qualityByTicket.get(entry.ticketId);

      return {
        id: entry.id,
        rank: entry.rank,
        score: entry.score,
        isWinner: entry.isWinner,
        keyDifferentiators: entry.keyDifferentiators,
        metrics: {
          linesAdded: entry.linesAdded,
          linesRemoved: entry.linesRemoved,
          sourceFileCount: entry.sourceFileCount,
          testFileCount: entry.testFileCount,
          testRatio: entry.testRatio,
        },
        complianceData,
        ticket: entry.ticket,
        telemetry: telemetry
          ? { ...telemetry, model: telemetry.model ?? 'unknown' }
          : null,
        qualityScore: quality ?? null,
      };
    });

    const enrichedDecisionPoints = comparison.decisionPoints.map((dp) => {
      let approaches: Record<string, { approach: string; assessment: string }> = {};
      try {
        approaches = JSON.parse(dp.approaches) as Record<string, { approach: string; assessment: string }>;
      } catch {
        // Invalid JSON
      }

      return {
        id: dp.id,
        topic: dp.topic,
        verdict: dp.verdict,
        approaches,
      };
    });

    return NextResponse.json({
      id: comparison.id,
      projectId: comparison.projectId,
      sourceTicketKey: comparison.sourceTicket.ticketKey,
      recommendation: comparison.recommendation,
      notes: comparison.notes,
      createdAt: comparison.createdAt.toISOString(),
      entries: enrichedEntries,
      decisionPoints: enrichedDecisionPoints,
    });
  } catch (error) {
    console.error('Error fetching enriched comparison:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
