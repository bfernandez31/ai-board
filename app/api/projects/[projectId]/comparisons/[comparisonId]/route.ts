/**
 * Project-level Comparison Detail API Route
 *
 * GET /api/projects/:projectId/comparisons/:comparisonId
 * Returns full comparison detail for a specific comparison within a project.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import {
  aggregateJobTelemetry,
  buildComparisonDetail,
  createAvailableEnrichment,
  createPendingEnrichment,
  createUnavailableEnrichment,
  normalizeDecisionPoints,
  normalizeParticipantDetail,
  normalizeTelemetryEnrichment,
} from '@/lib/comparison/comparison-record';
import type { ComparisonEnrichmentValue } from '@/lib/types/comparison';
import type { QualityScoreDetails } from '@/lib/quality-score';
import type { ComparisonDetail } from '@/lib/types/comparison';

interface RouteParams {
  params: Promise<{ projectId: string; comparisonId: string }>;
}

function deriveQualityState(
  latestVerifyJob: { qualityScore: number | null } | null,
  hasVerifyJob: boolean
): ComparisonEnrichmentValue<number> {
  if (latestVerifyJob?.qualityScore != null) {
    return createAvailableEnrichment(latestVerifyJob.qualityScore);
  }
  if (hasVerifyJob) {
    return createPendingEnrichment<number>();
  }
  return createUnavailableEnrichment<number>();
}

function deriveQualityBreakdown(
  latestVerifyJob: {
    qualityScore: number | null;
    qualityScoreDetails: string | null;
  } | null,
  hasVerifyJob: boolean
): ComparisonEnrichmentValue<QualityScoreDetails> {
  if (latestVerifyJob?.qualityScoreDetails) {
    try {
      const parsed = JSON.parse(latestVerifyJob.qualityScoreDetails) as QualityScoreDetails;
      if (parsed.dimensions && parsed.threshold) {
        return createAvailableEnrichment(parsed);
      }
    } catch {
      // Fall through to unavailable
    }
  }
  if (hasVerifyJob && latestVerifyJob?.qualityScore != null) {
    return createPendingEnrichment<QualityScoreDetails>();
  }
  return createUnavailableEnrichment<QualityScoreDetails>();
}

export async function GET(
  _request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const { projectId, comparisonId } = await context.params;
    const projectIdNum = parseInt(projectId, 10);
    const comparisonIdNum = parseInt(comparisonId, 10);

    if (isNaN(projectIdNum)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }
    if (isNaN(comparisonIdNum)) {
      return NextResponse.json({ error: 'Invalid comparison ID' }, { status: 400 });
    }

    try {
      await verifyProjectAccess(projectIdNum);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const record = await prisma.comparisonRecord.findFirst({
      where: {
        id: comparisonIdNum,
        projectId: projectIdNum,
      },
      include: {
        sourceTicket: { select: { ticketKey: true } },
        winnerTicket: { select: { ticketKey: true } },
        participants: {
          orderBy: { rank: 'asc' },
          include: {
            metricSnapshot: true,
            ticket: {
              select: { id: true, ticketKey: true, title: true, stage: true },
            },
          },
        },
        decisionPoints: { orderBy: { displayOrder: 'asc' } },
      },
    });

    if (!record) {
      return NextResponse.json({ error: 'Comparison not found' }, { status: 404 });
    }

    const participantIds = record.participants.map((p) => p.ticketId);

    const [completedJobs, inProgressJobs, latestVerifyJobs, complianceRows] = await Promise.all([
      prisma.job.findMany({
        where: { ticketId: { in: participantIds }, status: 'COMPLETED' },
        select: {
          ticketId: true,
          inputTokens: true,
          outputTokens: true,
          durationMs: true,
          costUsd: true,
          model: true,
        },
      }),
      prisma.job.findMany({
        where: { ticketId: { in: participantIds }, status: { in: ['PENDING', 'RUNNING'] } },
        select: { ticketId: true },
      }),
      prisma.job.findMany({
        where: { ticketId: { in: participantIds }, command: 'verify' },
        orderBy: [{ completedAt: 'desc' }, { startedAt: 'desc' }],
        distinct: ['ticketId'],
        select: { ticketId: true, qualityScore: true, qualityScoreDetails: true },
      }),
      prisma.complianceAssessment.findMany({
        where: { comparisonParticipant: { comparisonRecordId: comparisonIdNum } },
        orderBy: [{ displayOrder: 'asc' }, { principleName: 'asc' }],
        include: {
          comparisonParticipant: {
            select: {
              ticketId: true,
              ticket: { select: { ticketKey: true } },
            },
          },
        },
      }),
    ]);

    const aggregatedTelemetry = aggregateJobTelemetry(completedJobs);
    const inProgressTicketIds = new Set(inProgressJobs.map((job) => job.ticketId));
    const latestVerifyJobByTicketId = new Map(
      latestVerifyJobs.map((job) => [job.ticketId, job])
    );
    const verifyJobTicketIds = new Set(latestVerifyJobs.map((job) => job.ticketId));

    const participants = record.participants.map((participant) =>
      normalizeParticipantDetail({
        participant,
        quality: deriveQualityState(
          latestVerifyJobByTicketId.get(participant.ticketId) ?? null,
          verifyJobTicketIds.has(participant.ticketId)
        ),
        qualityBreakdown: deriveQualityBreakdown(
          latestVerifyJobByTicketId.get(participant.ticketId) ?? null,
          verifyJobTicketIds.has(participant.ticketId)
        ),
        telemetry: normalizeTelemetryEnrichment(
          aggregatedTelemetry.get(participant.ticketId) ?? null,
          inProgressTicketIds.has(participant.ticketId)
        ),
      })
    );

    const groupedCompliance = new Map<
      string,
      {
        principleKey: string;
        principleName: string;
        displayOrder: number;
        assessments: ComparisonDetail['complianceRows'][number]['assessments'];
      }
    >();

    for (const row of complianceRows) {
      const existing = groupedCompliance.get(row.principleKey);
      const assessment = {
        participantTicketId: row.comparisonParticipant.ticketId,
        participantTicketKey: row.comparisonParticipant.ticket.ticketKey,
        status: row.status as 'pass' | 'mixed' | 'fail',
        notes: row.notes,
      };

      if (existing) {
        existing.assessments.push(assessment);
        continue;
      }

      groupedCompliance.set(row.principleKey, {
        principleKey: row.principleKey,
        principleName: row.principleName,
        displayOrder: row.displayOrder,
        assessments: [assessment],
      });
    }

    const detail = buildComparisonDetail({
      record,
      participants,
      decisionPoints: normalizeDecisionPoints(record.decisionPoints).sort(
        (a, b) => a.displayOrder - b.displayOrder
      ),
      complianceRows: [...groupedCompliance.values()].sort(
        (a, b) => a.displayOrder - b.displayOrder
      ),
    });

    return NextResponse.json(detail);
  } catch (error) {
    console.error('Error fetching comparison detail:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
