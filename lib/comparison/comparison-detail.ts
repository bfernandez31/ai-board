import { prisma } from '@/lib/db/client';
import type { ComparisonDetail, ComparisonSummary } from '@/lib/types/comparison';
import {
  buildComparisonDetail,
  createAvailableEnrichment,
  createPendingEnrichment,
  createUnavailableEnrichment,
  normalizeDecisionPoints,
  normalizeParticipantDetail,
  normalizeQualityDetailsEnrichment,
  normalizeTelemetryEnrichment,
  toComparisonHistorySummary,
} from './comparison-record';

type ComparisonRecordWhere = {
  OR: [
    { participants: { some: { ticketId: number } } },
    { sourceTicketId: number },
  ];
};

type JobSummary = {
  ticketId: number;
  status: string;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number | null;
  costUsd: number | null;
  model: string | null;
};

type VerifyJobSummary = {
  ticketId: number;
  qualityScore: number | null;
  qualityScoreDetails: string | null;
};

type NumericJobField = 'inputTokens' | 'outputTokens' | 'durationMs' | 'costUsd';

function buildComparisonRecordWhere(ticketId: number): ComparisonRecordWhere {
  return {
    OR: [
      { participants: { some: { ticketId } } },
      { sourceTicketId: ticketId },
    ],
  };
}

function groupJobsByTicketId(jobs: JobSummary[]): Map<number, JobSummary[]> {
  const jobsByTicketId = new Map<number, JobSummary[]>();

  for (const job of jobs) {
    const existingJobs = jobsByTicketId.get(job.ticketId);

    if (existingJobs) {
      existingJobs.push(job);
      continue;
    }

    jobsByTicketId.set(job.ticketId, [job]);
  }

  return jobsByTicketId;
}

function sumField(jobs: JobSummary[], field: NumericJobField): number | null {
  const withValues = jobs.filter((job) => job[field] != null);

  if (withValues.length === 0) {
    return null;
  }

  return withValues.reduce((sum, job) => sum + (job[field] ?? 0), 0);
}

function aggregateModel(jobs: Pick<JobSummary, 'model'>[]): string | null {
  const modelCounts = new Map<string, number>();

  for (const job of jobs) {
    if (!job.model) {
      continue;
    }

    modelCounts.set(job.model, (modelCounts.get(job.model) ?? 0) + 1);
  }

  let selectedModel: string | null = null;
  let selectedCount = 0;

  for (const [model, count] of modelCounts.entries()) {
    if (count > selectedCount) {
      selectedModel = model;
      selectedCount = count;
    }
  }

  return selectedModel;
}

function buildParticipantTelemetry(jobs: JobSummary[] | undefined) {
  if (!jobs || jobs.length === 0) {
    return null;
  }

  const inputTokens = sumField(jobs, 'inputTokens');
  const outputTokens = sumField(jobs, 'outputTokens');
  const durationMs = sumField(jobs, 'durationMs');
  const costUsd = sumField(jobs, 'costUsd');
  const totalTokens =
    inputTokens != null || outputTokens != null
      ? (inputTokens ?? 0) + (outputTokens ?? 0)
      : null;

  return {
    inputTokens,
    outputTokens,
    durationMs,
    costUsd,
    totalTokens,
    jobCount: jobs.length,
    model: aggregateModel(jobs),
  };
}

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
      where: buildComparisonRecordWhere(ticketId),
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
      where: buildComparisonRecordWhere(ticketId),
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
    where: buildComparisonRecordWhere(ticketId),
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
  const [allJobs, latestVerifyJobs, complianceRows] = await Promise.all([
    prisma.job.findMany({
      where: {
        ticketId: {
          in: participantIds,
        },
      },
      select: {
        ticketId: true,
        status: true,
        inputTokens: true,
        outputTokens: true,
        durationMs: true,
        costUsd: true,
        model: true,
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

  const jobsByTicketId = groupJobsByTicketId(allJobs);
  const latestVerifyJobByTicketId = new Map<number, VerifyJobSummary>(
    latestVerifyJobs.map((job) => [job.ticketId, job] as const)
  );
  const verifyJobTicketIds = new Set(latestVerifyJobs.map((job) => job.ticketId));
  const participants = record.participants.map((participant) => {
    const latestVerifyJob = latestVerifyJobByTicketId.get(participant.ticketId) ?? null;

    return normalizeParticipantDetail({
      participant,
      quality: deriveQualityState(
        latestVerifyJob,
        verifyJobTicketIds.has(participant.ticketId)
      ),
      qualityDetails: normalizeQualityDetailsEnrichment({
        qualityScoreDetails: latestVerifyJob?.qualityScoreDetails ?? null,
        workflowType: participant.workflowTypeAtComparison,
        stage: participant.ticket.stage,
      }),
      telemetry: normalizeTelemetryEnrichment(
        buildParticipantTelemetry(jobsByTicketId.get(participant.ticketId))
      ),
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
