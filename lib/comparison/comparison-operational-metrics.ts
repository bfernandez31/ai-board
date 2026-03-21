import { JobStatus, WorkflowType } from '@prisma/client';
import {
  DIMENSION_CONFIG,
  getDimensionName,
  getDimensionWeight,
  getScoreThreshold,
  parseQualityScoreDetails,
} from '@/lib/quality-score';
import type {
  ComparisonOperationalAggregate,
  ComparisonOperationalMetricValue,
  ComparisonQualityDetail,
  ComparisonQualityDimension,
  ComparisonQualitySummary,
} from '@/lib/types/comparison';

type ComparisonJobRecord = {
  ticketId: number;
  status: JobStatus;
  command: string;
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

type ParticipantAggregationInput = {
  ticketId: number;
  ticketKey: string;
  workflowType: WorkflowType;
  jobs: ComparisonJobRecord[];
};

type ParticipantAggregationResult = {
  quality: ComparisonQualitySummary;
  operational: ComparisonOperationalAggregate;
};

const NON_TERMINAL_JOB_STATUSES = new Set<JobStatus>([JobStatus.PENDING, JobStatus.RUNNING]);

function createUnavailableQualitySummary(): ComparisonQualitySummary {
  return {
    state: 'unavailable',
    score: null,
    threshold: null,
    detailsState: 'unavailable',
    details: null,
    isBest: false,
  };
}

function createOperationalMetricValue(
  state: ComparisonOperationalMetricValue['state'],
  value: number | null,
  displayLabel: string | null = null
): ComparisonOperationalMetricValue {
  return {
    state,
    value,
    isBest: false,
    displayLabel,
  };
}

function getLatestJobTime(job: ComparisonJobRecord): number {
  return (job.completedAt ?? job.startedAt).getTime();
}

function hasPendingJobs(jobs: ComparisonJobRecord[]): boolean {
  return jobs.some((job) => NON_TERMINAL_JOB_STATUSES.has(job.status));
}

function createJobCountValue(jobs: ComparisonJobRecord[]): ComparisonOperationalMetricValue {
  if (jobs.length === 0) {
    return createOperationalMetricValue('unavailable', null);
  }

  if (hasPendingJobs(jobs)) {
    return createOperationalMetricValue('pending', null);
  }

  return createOperationalMetricValue('available', jobs.length);
}

function sumMetric(
  jobs: ComparisonJobRecord[],
  getter: (job: ComparisonJobRecord) => number | null
): ComparisonOperationalMetricValue {
  if (jobs.length === 0) {
    return createOperationalMetricValue('unavailable', null);
  }

  if (hasPendingJobs(jobs)) {
    return createOperationalMetricValue('pending', null);
  }

  const values = jobs
    .map((job) => getter(job))
    .filter((value): value is number => value != null);

  if (values.length === 0) {
    return createOperationalMetricValue('unavailable', null);
  }

  return createOperationalMetricValue(
    'available',
    values.reduce((total, value) => total + value, 0)
  );
}

function summarizeModel(jobs: ComparisonJobRecord[]): ComparisonOperationalAggregate['model'] {
  const completedJobs = jobs.filter((job) => job.status === JobStatus.COMPLETED);
  const completedJobCount = completedJobs.length;

  if (jobs.length === 0) {
    return {
      state: 'unavailable',
      label: null,
      dominantModel: null,
      completedJobCount: 0,
      mixedModels: false,
    };
  }

  if (hasPendingJobs(jobs)) {
    return {
      state: 'pending',
      label: null,
      dominantModel: null,
      completedJobCount,
      mixedModels: false,
    };
  }

  const modelEntries = new Map<
    string,
    { tokenTotal: number; durationTotal: number; jobCount: number }
  >();

  for (const job of completedJobs) {
    if (!job.model) {
      continue;
    }

    const existing = modelEntries.get(job.model) ?? {
      tokenTotal: 0,
      durationTotal: 0,
      jobCount: 0,
    };

    existing.tokenTotal += (job.inputTokens ?? 0) + (job.outputTokens ?? 0);
    existing.durationTotal += job.durationMs ?? 0;
    existing.jobCount += 1;
    modelEntries.set(job.model, existing);
  }

  if (modelEntries.size === 0) {
    return {
      state: 'unavailable',
      label: null,
      dominantModel: null,
      completedJobCount,
      mixedModels: false,
    };
  }

  const rankedModels = [...modelEntries.entries()].sort((a, b) => {
    const tokenDelta = b[1].tokenTotal - a[1].tokenTotal;
    if (tokenDelta !== 0) {
      return tokenDelta;
    }

    const durationDelta = b[1].durationTotal - a[1].durationTotal;
    if (durationDelta !== 0) {
      return durationDelta;
    }

    const countDelta = b[1].jobCount - a[1].jobCount;
    if (countDelta !== 0) {
      return countDelta;
    }

    return a[0].localeCompare(b[0]);
  });

  const [topModel, nextModel] = rankedModels;
  const topStats = topModel?.[1];
  const nextStats = nextModel?.[1];
  const isMixed =
    topStats != null &&
    nextStats != null &&
    topStats.tokenTotal === nextStats.tokenTotal &&
    topStats.durationTotal === nextStats.durationTotal &&
    topStats.jobCount === nextStats.jobCount;

  if (!topModel || isMixed) {
    return {
      state: 'available',
      label: 'Multiple models',
      dominantModel: null,
      completedJobCount,
      mixedModels: true,
    };
  }

  return {
    state: 'available',
    label: topModel[0],
    dominantModel: topModel[0],
    completedJobCount,
    mixedModels: modelEntries.size > 1,
  };
}

export function createUnavailableOperationalAggregate(): ComparisonOperationalAggregate {
  return {
    totalTokens: createOperationalMetricValue('unavailable', null),
    inputTokens: createOperationalMetricValue('unavailable', null),
    outputTokens: createOperationalMetricValue('unavailable', null),
    durationMs: createOperationalMetricValue('unavailable', null),
    costUsd: createOperationalMetricValue('unavailable', null),
    jobCount: createOperationalMetricValue('unavailable', null),
    model: {
      state: 'unavailable',
      label: null,
      dominantModel: null,
      completedJobCount: 0,
      mixedModels: false,
    },
  };
}

function normalizeQualityDimensions(
  details: NonNullable<ReturnType<typeof parseQualityScoreDetails>>
): ComparisonQualityDimension[] {
  if (details.dimensions.length === 0) {
    return [];
  }

  return details.dimensions
    .map((dimension) => ({
      agentId: dimension.agentId,
      name: dimension.name || getDimensionName(dimension.agentId),
      score: dimension.score,
      weight: dimension.weight ?? getDimensionWeight(dimension.agentId),
    }))
    .sort((a, b) => {
      const aOrder = DIMENSION_CONFIG.find((dimension) => dimension.agentId === a.agentId)?.order;
      const bOrder = DIMENSION_CONFIG.find((dimension) => dimension.agentId === b.agentId)?.order;

      if (aOrder == null || bOrder == null) {
        return 0;
      }

      return aOrder - bOrder;
    });
}

function buildQualityDetail(
  input: ParticipantAggregationInput,
  score: number,
  detailsString: string | null
): ComparisonQualityDetail | null {
  if (input.workflowType !== WorkflowType.FULL) {
    return null;
  }

  const parsedDetails = parseQualityScoreDetails(detailsString);
  if (!parsedDetails) {
    return null;
  }

  const dimensions = normalizeQualityDimensions(parsedDetails);
  if (dimensions.length === 0) {
    return null;
  }

  return {
    ticketId: input.ticketId,
    ticketKey: input.ticketKey,
    score,
    threshold: getScoreThreshold(score),
    dimensions,
  };
}

function summarizeQuality(input: ParticipantAggregationInput): ComparisonQualitySummary {
  const verifyJobs = input.jobs
    .filter((job) => job.command === 'verify')
    .sort((a, b) => getLatestJobTime(b) - getLatestJobTime(a));

  const latestCompletedVerifyJob = verifyJobs.find((job) => job.status === JobStatus.COMPLETED);

  if (latestCompletedVerifyJob?.qualityScore != null) {
    const details = buildQualityDetail(
      input,
      latestCompletedVerifyJob.qualityScore,
      latestCompletedVerifyJob.qualityScoreDetails
    );

    return {
      state: 'available',
      score: latestCompletedVerifyJob.qualityScore,
      threshold: getScoreThreshold(latestCompletedVerifyJob.qualityScore),
      detailsState: details ? 'available' : 'summary_only',
      details,
      isBest: false,
    };
  }

  if (verifyJobs.length > 0) {
    return {
      state: 'pending',
      score: null,
      threshold: null,
      detailsState: 'unavailable',
      details: null,
      isBest: false,
    };
  }

  return createUnavailableQualitySummary();
}

function getTotalTokens(job: ComparisonJobRecord): number | null {
  if (job.inputTokens == null && job.outputTokens == null) {
    return null;
  }

  return (job.inputTokens ?? 0) + (job.outputTokens ?? 0);
}

function buildParticipantAggregation(input: ParticipantAggregationInput): ParticipantAggregationResult {
  return {
    quality: summarizeQuality(input),
    operational: {
      totalTokens: sumMetric(input.jobs, getTotalTokens),
      inputTokens: sumMetric(input.jobs, (job) => job.inputTokens),
      outputTokens: sumMetric(input.jobs, (job) => job.outputTokens),
      durationMs: sumMetric(input.jobs, (job) => job.durationMs),
      costUsd: sumMetric(input.jobs, (job) => job.costUsd),
      jobCount: createJobCountValue(input.jobs),
      model: summarizeModel(input.jobs),
    },
  };
}

function applyBestFlags(
  results: ParticipantAggregationResult[],
  selector: (result: ParticipantAggregationResult) => ComparisonOperationalMetricValue,
  direction: 'min' | 'max'
): void {
  const availableValues = results
    .map((result) => selector(result))
    .filter((metric) => metric.state === 'available' && metric.value != null);

  if (availableValues.length === 0) {
    return;
  }

  const targetValue =
    direction === 'min'
      ? Math.min(...availableValues.map((metric) => metric.value as number))
      : Math.max(...availableValues.map((metric) => metric.value as number));

  for (const result of results) {
    const metric = selector(result);
    metric.isBest = metric.state === 'available' && metric.value === targetValue;
  }
}

function applyQualityBestFlags(results: ParticipantAggregationResult[]): void {
  const availableScores = results
    .map((result) => result.quality)
    .filter((quality) => quality.state === 'available' && quality.score != null);

  if (availableScores.length === 0) {
    return;
  }

  const bestScore = Math.max(...availableScores.map((quality) => quality.score as number));
  for (const result of results) {
    result.quality.isBest =
      result.quality.state === 'available' && result.quality.score === bestScore;
  }
}

export function buildComparisonOperationalData(
  participants: ParticipantAggregationInput[]
): Map<number, ParticipantAggregationResult> {
  const results = participants.map((participant) => ({
    ticketId: participant.ticketId,
    result: buildParticipantAggregation(participant),
  }));

  const values = results.map((entry) => entry.result);
  applyBestFlags(values, (result) => result.operational.totalTokens, 'min');
  applyBestFlags(values, (result) => result.operational.inputTokens, 'min');
  applyBestFlags(values, (result) => result.operational.outputTokens, 'min');
  applyBestFlags(values, (result) => result.operational.durationMs, 'min');
  applyBestFlags(values, (result) => result.operational.costUsd, 'min');
  applyBestFlags(values, (result) => result.operational.jobCount, 'min');
  applyQualityBestFlags(values);

  return new Map(results.map((entry) => [entry.ticketId, entry.result]));
}
