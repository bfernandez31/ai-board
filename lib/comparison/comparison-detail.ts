import { prisma } from '@/lib/db/client';
import type { ComparisonDetail, ComparisonSummary } from '@/lib/types/comparison';
import {
  buildComparisonDetail,
  normalizeDecisionPoints,
  normalizeParticipantDetail,
  toComparisonHistorySummary,
} from './comparison-record';
import { buildComparisonOperationalData } from './comparison-operational-metrics';

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
  const [jobs, complianceRows] = await Promise.all([
    prisma.job.findMany({
      where: {
        ticketId: {
          in: participantIds,
        },
      },
      select: {
        ticketId: true,
        status: true,
        command: true,
        inputTokens: true,
        outputTokens: true,
        durationMs: true,
        costUsd: true,
        model: true,
        qualityScore: true,
        qualityScoreDetails: true,
        startedAt: true,
        completedAt: true,
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

  const jobsByTicketId = new Map<number, typeof jobs>();
  for (const job of jobs) {
    const existing = jobsByTicketId.get(job.ticketId);
    if (existing) {
      existing.push(job);
      continue;
    }

    jobsByTicketId.set(job.ticketId, [job]);
  }

  const aggregationByTicketId = buildComparisonOperationalData(
    record.participants.map((participant) => ({
      ticketId: participant.ticketId,
      ticketKey: participant.ticket.ticketKey,
      workflowType: participant.workflowTypeAtComparison,
      jobs: jobsByTicketId.get(participant.ticketId) ?? [],
    }))
  );

  const participants = record.participants.map((participant) =>
    normalizeParticipantDetail({
      participant,
      quality: aggregationByTicketId.get(participant.ticketId)?.quality ?? {
        state: 'unavailable',
        score: null,
        threshold: null,
        detailsState: 'unavailable',
        details: null,
        isBest: false,
      },
      operational: aggregationByTicketId.get(participant.ticketId)?.operational ?? {
        totalTokens: { state: 'unavailable', value: null, isBest: false },
        inputTokens: { state: 'unavailable', value: null, isBest: false },
        outputTokens: { state: 'unavailable', value: null, isBest: false },
        durationMs: { state: 'unavailable', value: null, isBest: false },
        costUsd: { state: 'unavailable', value: null, isBest: false },
        jobCount: { state: 'unavailable', value: null, isBest: false },
        model: {
          state: 'unavailable',
          label: null,
          dominantModel: null,
          completedJobCount: 0,
          mixedModels: false,
        },
      },
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

  return buildComparisonDetail({
    record,
    participants,
    decisionPoints: normalizeDecisionPoints(record.decisionPoints),
    complianceRows: [...groupedCompliance.values()].sort(
      (a, b) => a.displayOrder - b.displayOrder
    ),
  });
}
