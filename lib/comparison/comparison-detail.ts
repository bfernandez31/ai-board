import { prisma } from '@/lib/db/client';
import type { AggregatedTelemetry, ComparisonDetail, ComparisonSummary } from '@/lib/types/comparison';
import { parseQualityScoreDetails } from '@/lib/quality-score';
import { aggregateJobTelemetry } from './telemetry-extractor';
import {
  buildComparisonDetail,
  createAvailableEnrichment,
  createPendingEnrichment,
  createUnavailableEnrichment,
  normalizeDecisionPoints,
  normalizeParticipantDetail,
  normalizeTelemetryEnrichment,
  toComparisonHistorySummary,
} from './comparison-record';

export async function listTicketComparisons(
  ticketId: number,
  limit: number
): Promise<{
  comparisons: ComparisonSummary[];
  total: number;
  limit: number;
}> {
  const [records, total] = await prisma.$transaction([
    prisma.comparisonRecord.findMany({
      where: {
        OR: [
          { participants: { some: { ticketId } } },
          { sourceTicketId: ticketId },
        ],
      },
      orderBy: {
        generatedAt: 'desc',
      },
      take: limit,
      include: {
        sourceTicket: {
          select: {
            ticketKey: true,
          },
        },
        winnerTicket: {
          select: {
            ticketKey: true,
          },
        },
        participants: {
          orderBy: {
            rank: 'asc',
          },
          include: {
            ticket: {
              select: {
                ticketKey: true,
              },
            },
          },
        },
      },
    }),
    prisma.comparisonRecord.count({
      where: {
        OR: [
          { participants: { some: { ticketId } } },
          { sourceTicketId: ticketId },
        ],
      },
    }),
  ]);

  return {
    comparisons: records.map(toComparisonHistorySummary),
    total,
    limit,
  };
}

export async function getTicketComparisonCheck(ticketId: number): Promise<{
  hasComparisons: boolean;
  count: number;
  latestComparisonId: number | null;
}> {
  const records = await prisma.comparisonRecord.findMany({
    where: {
      OR: [
        { participants: { some: { ticketId } } },
        { sourceTicketId: ticketId },
      ],
    },
    select: {
      id: true,
      generatedAt: true,
    },
    orderBy: {
      generatedAt: 'desc',
    },
  });

  return {
    hasComparisons: records.length > 0,
    count: records.length,
    latestComparisonId: records.at(0)?.id ?? null,
  };
}

function deriveQualityState(
  latestVerifyJob: { qualityScore: number | null } | null,
  hasVerifyJob: boolean
): ReturnType<typeof createAvailableEnrichment<number>> {
  if (latestVerifyJob?.qualityScore != null) {
    return createAvailableEnrichment(latestVerifyJob.qualityScore);
  }

  if (hasVerifyJob) {
    return createPendingEnrichment<number>();
  }

  return createUnavailableEnrichment<number>();
}

export async function getComparisonDetailForTicket(
  ticketId: number,
  comparisonId: number
): Promise<ComparisonDetail | null> {
  const record = await prisma.comparisonRecord.findFirst({
    where: {
      id: comparisonId,
      OR: [
        { participants: { some: { ticketId } } },
        { sourceTicketId: ticketId },
      ],
    },
    include: {
      sourceTicket: {
        select: {
          ticketKey: true,
        },
      },
      winnerTicket: {
        select: {
          ticketKey: true,
        },
      },
      participants: {
        orderBy: {
          rank: 'asc',
        },
        include: {
          metricSnapshot: true,
          ticket: {
            select: {
              id: true,
              ticketKey: true,
              title: true,
              stage: true,
            },
          },
        },
      },
      decisionPoints: {
        orderBy: {
          displayOrder: 'asc',
        },
      },
    },
  });

  if (!record) {
    return null;
  }

  const participantIds = record.participants.map((participant) => participant.ticketId);
  const [latestJobs, latestVerifyJobs, allCompletedJobs, complianceRows] = await Promise.all([
    prisma.job.findMany({
      where: {
        ticketId: {
          in: participantIds,
        },
      },
      orderBy: [{ completedAt: 'desc' }, { startedAt: 'desc' }],
      distinct: ['ticketId'],
      select: {
        ticketId: true,
        inputTokens: true,
        outputTokens: true,
        durationMs: true,
        costUsd: true,
      },
    }),
    prisma.job.findMany({
      where: {
        ticketId: {
          in: participantIds,
        },
        command: 'verify',
      },
      orderBy: [{ completedAt: 'desc' }, { startedAt: 'desc' }],
      distinct: ['ticketId'],
      select: {
        ticketId: true,
        qualityScore: true,
        qualityScoreDetails: true,
      },
    }),
    prisma.job.findMany({
      where: {
        ticketId: {
          in: participantIds,
        },
        status: 'COMPLETED',
      },
      select: {
        ticketId: true,
        inputTokens: true,
        outputTokens: true,
        cacheReadTokens: true,
        cacheCreationTokens: true,
        costUsd: true,
        durationMs: true,
        model: true,
        toolsUsed: true,
      },
    }),
    prisma.complianceAssessment.findMany({
      where: {
        comparisonParticipant: {
          comparisonRecordId: comparisonId,
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { principleName: 'asc' }],
      include: {
        comparisonParticipant: {
          select: {
            ticketId: true,
            ticket: {
              select: {
                ticketKey: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const latestJobByTicketId = new Map(latestJobs.map((job) => [job.ticketId, job]));
  const latestVerifyJobByTicketId = new Map(
    latestVerifyJobs.map((job) => [job.ticketId, job])
  );
  const verifyJobTicketIds = new Set(latestVerifyJobs.map((job) => job.ticketId));

  const completedJobsByTicketId = new Map<number, typeof allCompletedJobs>();
  for (const job of allCompletedJobs) {
    const existing = completedJobsByTicketId.get(job.ticketId) ?? [];
    existing.push(job);
    completedJobsByTicketId.set(job.ticketId, existing);
  }

  const aggregatedTelemetryByTicketId = new Map<number, AggregatedTelemetry | null>();
  for (const ticketId of participantIds) {
    const jobs = completedJobsByTicketId.get(ticketId) ?? [];
    if (jobs.length === 0) {
      aggregatedTelemetryByTicketId.set(ticketId, null);
      continue;
    }
    const ticketKey = record.participants.find((p) => p.ticketId === ticketId)?.ticket.ticketKey ?? '';
    const telemetry = aggregateJobTelemetry(ticketKey, jobs.map((j) => ({
      ...j,
      toolsUsed: Array.isArray(j.toolsUsed) ? j.toolsUsed.filter((t): t is string => typeof t === 'string') : [],
    })));
    aggregatedTelemetryByTicketId.set(ticketId, {
      inputTokens: telemetry.inputTokens,
      outputTokens: telemetry.outputTokens,
      totalTokens: telemetry.inputTokens + telemetry.outputTokens,
      costUsd: telemetry.costUsd,
      durationMs: telemetry.durationMs,
      jobCount: telemetry.jobCount,
      model: telemetry.model,
      hasData: telemetry.hasData,
    });
  }

  const participants = record.participants.map((participant) => {
    const verifyJob = latestVerifyJobByTicketId.get(participant.ticketId);
    const qualityDetails = verifyJob
      ? parseQualityScoreDetails(verifyJob.qualityScoreDetails)
      : null;

    return normalizeParticipantDetail({
      participant,
      quality: deriveQualityState(
        latestVerifyJobByTicketId.get(participant.ticketId) ?? null,
        verifyJobTicketIds.has(participant.ticketId)
      ),
      telemetry: normalizeTelemetryEnrichment(
        latestJobByTicketId.get(participant.ticketId) ?? null
      ),
      aggregatedTelemetry: aggregatedTelemetryByTicketId.get(participant.ticketId) ?? null,
      qualityDetails,
    });
  });

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

  return buildComparisonDetail({
    record,
    participants,
    decisionPoints: normalizeDecisionPoints(record.decisionPoints),
    complianceRows: [...groupedCompliance.values()].sort(
      (a, b) => a.displayOrder - b.displayOrder
    ),
  });
}
