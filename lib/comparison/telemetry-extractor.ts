import type { TicketTelemetry } from '@/lib/types/comparison';
import type { Prisma, JobStatus } from '@prisma/client';

interface JobTelemetryData {
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;
  costUsd: number | null;
  durationMs: number | null;
  model: string | null;
  toolsUsed: string[];
}

export function aggregateJobTelemetry(
  ticketKey: string,
  jobs: JobTelemetryData[]
): TicketTelemetry {
  if (jobs.length === 0) {
    return createEmptyTelemetry(ticketKey);
  }

  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreationTokens = 0;
  let costUsd = 0;
  let durationMs = 0;

  const toolsSet = new Set<string>();
  const modelCounts = new Map<string, number>();

  for (const job of jobs) {
    inputTokens += job.inputTokens ?? 0;
    outputTokens += job.outputTokens ?? 0;
    cacheReadTokens += job.cacheReadTokens ?? 0;
    cacheCreationTokens += job.cacheCreationTokens ?? 0;
    costUsd += job.costUsd ?? 0;
    durationMs += job.durationMs ?? 0;

    for (const tool of job.toolsUsed) {
      toolsSet.add(tool);
    }

    if (job.model) {
      modelCounts.set(job.model, (modelCounts.get(job.model) ?? 0) + 1);
    }
  }

  let primaryModel: string | null = null;
  let maxCount = 0;
  for (const [model, count] of modelCounts) {
    if (count > maxCount) {
      maxCount = count;
      primaryModel = model;
    }
  }

  const hasData =
    inputTokens > 0 || outputTokens > 0 || costUsd > 0 || durationMs > 0;

  return {
    ticketKey,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    costUsd,
    durationMs,
    model: primaryModel,
    toolsUsed: Array.from(toolsSet).sort(),
    jobCount: jobs.length,
    hasData,
  };
}

export function createEmptyTelemetry(ticketKey: string): TicketTelemetry {
  return {
    ticketKey,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    costUsd: 0,
    durationMs: 0,
    model: null,
    toolsUsed: [],
    jobCount: 0,
    hasData: false,
  };
}

export function buildTelemetryQuery(
  ticketId: number
): Prisma.JobFindManyArgs {
  return {
    where: {
      ticketId,
      status: 'COMPLETED' as JobStatus,
    },
    select: {
      inputTokens: true,
      outputTokens: true,
      cacheReadTokens: true,
      cacheCreationTokens: true,
      costUsd: true,
      durationMs: true,
      model: true,
      toolsUsed: true,
    },
  };
}

export function formatTelemetryDisplay(telemetry: TicketTelemetry): {
  tokens: string;
  cost: string;
  duration: string;
  model: string;
} {
  if (!telemetry.hasData) {
    return {
      tokens: 'N/A',
      cost: 'N/A',
      duration: 'N/A',
      model: 'N/A',
    };
  }

  const totalTokens = telemetry.inputTokens + telemetry.outputTokens;

  return {
    tokens: totalTokens.toLocaleString(),
    cost: telemetry.costUsd > 0 ? `$${telemetry.costUsd.toFixed(4)}` : 'N/A',
    duration:
      telemetry.durationMs > 0
        ? formatDuration(telemetry.durationMs)
        : 'N/A',
    model: telemetry.model ?? 'N/A',
  };
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export function calculateTotalCost(
  telemetry: Record<string, TicketTelemetry>
): number {
  return Object.values(telemetry).reduce(
    (sum, t) => sum + (t.hasData ? t.costUsd : 0),
    0
  );
}

export function calculateTotalTokens(
  telemetry: Record<string, TicketTelemetry>
): { input: number; output: number; total: number } {
  let input = 0;
  let output = 0;

  for (const t of Object.values(telemetry)) {
    if (t.hasData) {
      input += t.inputTokens;
      output += t.outputTokens;
    }
  }

  return { input, output, total: input + output };
}

export function compareTelemetry(
  t1: TicketTelemetry,
  t2: TicketTelemetry
): {
  costDiff: number;
  costDiffPercent: number;
  tokensDiff: number;
  tokensDiffPercent: number;
  durationDiff: number;
  durationDiffPercent: number;
} {
  const tokens1 = t1.inputTokens + t1.outputTokens;
  const tokens2 = t2.inputTokens + t2.outputTokens;

  const costDiff = t2.costUsd - t1.costUsd;
  const tokensDiff = tokens2 - tokens1;
  const durationDiff = t2.durationMs - t1.durationMs;

  const costDiffPercent =
    t1.costUsd > 0 ? (costDiff / t1.costUsd) * 100 : tokensDiff !== 0 ? 100 : 0;
  const tokensDiffPercent =
    tokens1 > 0 ? (tokensDiff / tokens1) * 100 : tokensDiff !== 0 ? 100 : 0;
  const durationDiffPercent =
    t1.durationMs > 0
      ? (durationDiff / t1.durationMs) * 100
      : durationDiff !== 0
        ? 100
        : 0;

  return {
    costDiff,
    costDiffPercent,
    tokensDiff,
    tokensDiffPercent,
    durationDiff,
    durationDiffPercent,
  };
}
