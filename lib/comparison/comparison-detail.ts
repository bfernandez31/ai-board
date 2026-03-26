import { prisma } from '@/lib/db/client';
import {
  DIMENSION_CONFIG,
  getScoreThreshold,
  parseQualityScoreDetails,
} from '@/lib/quality-score';
import type {
  ComparisonDetail,
  ComparisonQualitySummary,
  ComparisonSummary,
} from '@/lib/types/comparison';
import {
  buildComparisonDetail,
  createAvailableEnrichment,
  createPendingEnrichment,
  createUnavailableEnrichment,
  normalizeDecisionPoints,
  normalizeOperationalMetrics,
  normalizeParticipantDetail,
  normalizeQualitySummary,
  toComparisonHistorySummary,
} from './comparison-record';

type ComparisonJobRecord = {
  ticketId: number;
  command: string;
  status: string;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number | null;
  costUsd: number | null;
  model: string | null;
  qualityScore: number | null;
  qualityScoreDetails: string | null;
  startedAt: Date;
  completedAt: Date | null;
};

type ParticipantOperationalAggregate = ReturnType<typeof aggregateParticipantOperationalMetrics>;
type ParticipantQualityAggregate = ComparisonQualitySummary;

const OPERATIONAL_METRIC_KEYS = [
  'totalTokens',
  'inputTokens',
  'outputTokens',
  'durationMs',
  'costUsd',
  'jobCount',
] as const;

const OPERATIONAL_METRIC_DIRECTIONS = {
  totalTokens: 'lowest',
  inputTokens: 'lowest',
  outputTokens: 'lowest',
  durationMs: 'lowest',
  costUsd: 'lowest',
  jobCount: 'lowest',
  quality: 'highest',
} as const;

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

function isTerminalJob(job: ComparisonJobRecord): boolean {
  return job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED';
}

function getJobTimestamp(job: ComparisonJobRecord): number {
  return new Date(job.completedAt ?? job.startedAt).getTime();
}

function getLatestJob(jobs: ComparisonJobRecord[], command?: string): ComparisonJobRecord | null {
  let latestJob: ComparisonJobRecord | null = null;

  for (const job of jobs) {
    if (command && job.command !== command) {
      continue;
    }

    if (
      latestJob == null ||
      getJobTimestamp(job) > getJobTimestamp(latestJob)
    ) {
      latestJob = job;
    }
  }

  return latestJob;
}

function createMetricValue(
  jobs: ComparisonJobRecord[],
  values: Array<number | null>
): ReturnType<typeof createAvailableEnrichment<number>> {
  if (jobs.length === 0) {
    return createUnavailableEnrichment<number>();
  }

  if (values.some((value) => value == null)) {
    return createPendingEnrichment<number>();
  }

  return createAvailableEnrichment(
    values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
  );
}

export function selectPrimaryModel(jobs: ComparisonJobRecord[]): string | null {
  const modelStats = new Map<
    string,
    {
      totalTokens: number;
      latestCompletedAt: number;
    }
  >();

  for (const job of jobs) {
    if (!job.model) {
      continue;
    }

    const totalTokens = (job.inputTokens ?? 0) + (job.outputTokens ?? 0);
    const existing = modelStats.get(job.model) ?? {
      totalTokens: 0,
      latestCompletedAt: 0,
    };

    existing.totalTokens += totalTokens;
    existing.latestCompletedAt = Math.max(existing.latestCompletedAt, getJobTimestamp(job));

    modelStats.set(job.model, existing);
  }

  let selectedModel: string | null = null;
  let selectedTotalTokens = -1;
  let selectedCompletedAt = -1;

  for (const [model, stats] of modelStats.entries()) {
    if (
      stats.totalTokens > selectedTotalTokens ||
      (stats.totalTokens === selectedTotalTokens &&
        stats.latestCompletedAt > selectedCompletedAt)
    ) {
      selectedModel = model;
      selectedTotalTokens = stats.totalTokens;
      selectedCompletedAt = stats.latestCompletedAt;
    }
  }

  return selectedModel;
}

export function aggregateParticipantOperationalMetrics(jobs: ComparisonJobRecord[]) {
  return {
    totalTokens: createMetricValue(
      jobs,
      jobs.map((job) =>
        job.inputTokens != null && job.outputTokens != null
          ? job.inputTokens + job.outputTokens
          : null
      )
    ),
    inputTokens: createMetricValue(
      jobs,
      jobs.map((job) => job.inputTokens)
    ),
    outputTokens: createMetricValue(
      jobs,
      jobs.map((job) => job.outputTokens)
    ),
    durationMs: createMetricValue(
      jobs,
      jobs.map((job) => job.durationMs)
    ),
    costUsd: createMetricValue(
      jobs,
      jobs.map((job) => job.costUsd)
    ),
    jobCount:
      jobs.length > 0
        ? createAvailableEnrichment(jobs.length)
        : createUnavailableEnrichment<number>(),
    primaryModel: selectPrimaryModel(jobs),
  };
}

function normalizeQualityDimensions(details: string | null) {
  const parsed = parseQualityScoreDetails(details);
  if (!parsed) {
    return null;
  }

  const dimensionById = new Map(parsed.dimensions.map((dimension) => [dimension.agentId, dimension]));
  const dimensions = DIMENSION_CONFIG.map((config) => {
    const match = dimensionById.get(config.agentId);
    if (!match || typeof match.score !== 'number' || typeof match.weight !== 'number') {
      return null;
    }

    return {
      agentId: config.agentId,
      name: config.name,
      score: match.score,
      weight: match.weight,
    };
  });

  if (dimensions.some((dimension) => dimension == null)) {
    return null;
  }

  return {
    threshold: parsed.threshold,
    dimensions: dimensions.filter(
      (dimension): dimension is NonNullable<typeof dimension> => dimension != null
    ),
  };
}

function createUnavailableQualitySummary(): ParticipantQualityAggregate {
  return {
    score: createUnavailableEnrichment<number>(),
    thresholdLabel: null,
    detailAvailable: false,
    breakdown: null,
    isBestValue: false,
  };
}

function createPendingQualitySummary(): ParticipantQualityAggregate {
  return {
    score: createPendingEnrichment<number>(),
    thresholdLabel: null,
    detailAvailable: false,
    breakdown: null,
    isBestValue: false,
  };
}

export function deriveComparisonQualitySummary(
  workflowType: string,
  jobs: ComparisonJobRecord[]
): ComparisonQualitySummary {
  const verifyJobs = jobs.filter((job) => job.command === 'verify');
  const latestVerifyJob = getLatestJob(verifyJobs, 'verify');

  if (!latestVerifyJob) {
    return createUnavailableQualitySummary();
  }

  if (latestVerifyJob.status !== 'COMPLETED') {
    return createPendingQualitySummary();
  }

  if (latestVerifyJob.qualityScore == null) {
    return createPendingQualitySummary();
  }

  const score = createAvailableEnrichment(latestVerifyJob.qualityScore);
  const parsedDetails =
    workflowType === 'FULL'
      ? normalizeQualityDimensions(latestVerifyJob.qualityScoreDetails)
      : null;
  const thresholdLabel =
    parsedDetails?.threshold ?? getScoreThreshold(latestVerifyJob.qualityScore);
  const breakdown =
    parsedDetails == null
      ? null
      : {
          overallScore: latestVerifyJob.qualityScore,
          thresholdLabel,
          dimensions: parsedDetails.dimensions,
        };

  return {
    score,
    thresholdLabel,
    detailAvailable: breakdown != null,
    breakdown,
    isBestValue: false,
  };
}

function collectBestValueCandidates(
  operationalByTicketId: Map<number, ParticipantOperationalAggregate>,
  key: typeof OPERATIONAL_METRIC_KEYS[number]
): Array<{
  ticketId: number;
  value: number | null;
  state: 'available' | 'pending' | 'unavailable';
}> {
  return [...operationalByTicketId.entries()].map(([ticketId, aggregate]) => ({
    ticketId,
    ...aggregate[key],
  }));
}

export function selectBestValueTicketIds(
  values: Array<{
    ticketId: number;
    value: number | null;
    state: 'available' | 'pending' | 'unavailable';
  }>,
  direction: 'lowest' | 'highest'
): number[] {
  const available = values.filter(
    (value): value is typeof value & { value: number } =>
      value.state === 'available' && typeof value.value === 'number'
  );

  if (available.length === 0) {
    return [];
  }

  const target =
    direction === 'lowest'
      ? Math.min(...available.map((value) => value.value))
      : Math.max(...available.map((value) => value.value));

  return available
    .filter((value) => value.value === target)
    .map((value) => value.ticketId);
}

function applyBestValueFlags(
  operationalByTicketId: Map<number, ParticipantOperationalAggregate>,
  qualityByTicketId: Map<number, ParticipantQualityAggregate>
) {
  const bestOperational = Object.fromEntries(
    OPERATIONAL_METRIC_KEYS.map((key) => [
      key,
      selectBestValueTicketIds(
        collectBestValueCandidates(operationalByTicketId, key),
        OPERATIONAL_METRIC_DIRECTIONS[key]
      ),
    ])
  ) as Record<typeof OPERATIONAL_METRIC_KEYS[number], number[]>;

  const bestQuality = new Set(
    selectBestValueTicketIds(
      [...qualityByTicketId.entries()].map(([ticketId, quality]) => ({
        ticketId,
        ...quality.score,
      })),
      OPERATIONAL_METRIC_DIRECTIONS.quality
    )
  );

  return { bestOperational, bestQuality };
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
      orderBy: [{ completedAt: 'desc' }, { startedAt: 'desc' }],
      select: {
        ticketId: true,
        command: true,
        status: true,
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

  const jobsByTicketId = new Map<number, ComparisonJobRecord[]>();
  for (const job of jobs) {
    const currentJobs = jobsByTicketId.get(job.ticketId) ?? [];
    currentJobs.push(job);
    jobsByTicketId.set(job.ticketId, currentJobs);
  }

  const operationalByTicketId = new Map<number, ParticipantOperationalAggregate>();
  const qualityByTicketId = new Map<number, ParticipantQualityAggregate>();

  for (const participant of record.participants) {
    const participantJobs = (jobsByTicketId.get(participant.ticketId) ?? []).filter(
      (job) => isTerminalJob(job) || job.status === 'RUNNING' || job.status === 'PENDING'
    );

    operationalByTicketId.set(
      participant.ticketId,
      aggregateParticipantOperationalMetrics(participantJobs)
    );
    qualityByTicketId.set(
      participant.ticketId,
      deriveComparisonQualitySummary(
        participant.workflowTypeAtComparison,
        participantJobs
      )
    );
  }

  const { bestOperational, bestQuality } = applyBestValueFlags(
    operationalByTicketId,
    qualityByTicketId
  );

  const participants = record.participants.map((participant) =>
    (() => {
      const operationalAggregate =
        operationalByTicketId.get(participant.ticketId) ??
        aggregateParticipantOperationalMetrics([]);
      const qualityAggregate =
        qualityByTicketId.get(participant.ticketId) ??
        deriveComparisonQualitySummary(participant.workflowTypeAtComparison, []);

      return normalizeParticipantDetail({
        participant,
        quality: qualityAggregate.score,
        operational: normalizeOperationalMetrics({
          ...operationalAggregate,
          bestValueFlags: {
            totalTokens: bestOperational.totalTokens.includes(participant.ticketId),
            inputTokens: bestOperational.inputTokens.includes(participant.ticketId),
            outputTokens: bestOperational.outputTokens.includes(participant.ticketId),
            durationMs: bestOperational.durationMs.includes(participant.ticketId),
            costUsd: bestOperational.costUsd.includes(participant.ticketId),
            jobCount: bestOperational.jobCount.includes(participant.ticketId),
          },
        }),
        qualitySummary: normalizeQualitySummary({
          ...qualityAggregate,
          isBestValue: bestQuality.has(participant.ticketId),
        }),
      });
    })()
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
