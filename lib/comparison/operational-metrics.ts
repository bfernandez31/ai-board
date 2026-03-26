import type { ComparisonParticipantDetail } from '@/lib/types/comparison';
import type {
  OperationalMetricCell,
  OperationalMetricDefinition,
  OperationalMetricRow,
} from '@/components/comparison/types';
import { formatDurationMs } from './format-duration';
import { getScoreThreshold } from '@/lib/quality-score';

function formatTokens(value: number): string {
  return value.toLocaleString();
}

function formatCost(value: number): string {
  return `$${value.toFixed(4)}`;
}

function formatJobCount(value: number): string {
  return value.toString();
}

function formatQualityScore(value: number): string {
  return `${value} ${getScoreThreshold(value)}`;
}

export const METRIC_DEFINITIONS: OperationalMetricDefinition[] = [
  { key: 'totalTokens', label: 'Total Tokens', direction: 'lowest', format: formatTokens },
  { key: 'inputTokens', label: 'Input Tokens', direction: 'lowest', format: formatTokens },
  { key: 'outputTokens', label: 'Output Tokens', direction: 'lowest', format: formatTokens },
  { key: 'durationMs', label: 'Duration', direction: 'lowest', format: formatDurationMs },
  { key: 'costUsd', label: 'Cost', direction: 'lowest', format: formatCost },
  { key: 'jobCount', label: 'Job Count', direction: 'lowest', format: formatJobCount },
  { key: 'qualityScore', label: 'Quality Score', direction: 'highest', format: formatQualityScore },
];

export function determineBestValues(
  values: Array<{ index: number; value: number | null }>,
  direction: 'lowest' | 'highest'
): Set<number> {
  const validValues = values.filter((v) => v.value != null) as Array<{ index: number; value: number }>;
  if (validValues.length === 0) return new Set();

  const bestValue = direction === 'lowest'
    ? Math.min(...validValues.map((v) => v.value))
    : Math.max(...validValues.map((v) => v.value));

  return new Set(
    validValues.filter((v) => v.value === bestValue).map((v) => v.index)
  );
}

function getMetricValue(
  participant: ComparisonParticipantDetail,
  key: string
): { state: 'available' | 'pending' | 'unavailable'; value: number | null } {
  if (key === 'qualityScore') {
    return {
      state: participant.quality.state,
      value: participant.quality.value,
    };
  }

  const telemetry = participant.aggregatedTelemetry;
  if (!telemetry) {
    const hasAnyJob = participant.telemetry.inputTokens.state === 'pending';
    return { state: hasAnyJob ? 'pending' : 'unavailable', value: null };
  }

  if (!telemetry.hasData) {
    return { state: 'unavailable', value: null };
  }

  const valueMap: Record<string, number> = {
    totalTokens: telemetry.totalTokens,
    inputTokens: telemetry.inputTokens,
    outputTokens: telemetry.outputTokens,
    durationMs: telemetry.durationMs,
    costUsd: telemetry.costUsd,
    jobCount: telemetry.jobCount,
  };

  const value = valueMap[key];
  return value != null ? { state: 'available', value } : { state: 'unavailable', value: null };
}

export function buildOperationalMetricRows(
  participants: ComparisonParticipantDetail[]
): OperationalMetricRow[] {
  return METRIC_DEFINITIONS.map((definition) => {
    const extractedValues = participants.map((participant, index) => ({
      index,
      ...getMetricValue(participant, definition.key),
    }));

    const bestIndices = determineBestValues(extractedValues, definition.direction);

    const cells: OperationalMetricCell[] = extractedValues.map((extracted, index) => ({
      ticketId: participants[index]!.ticketId,
      state: extracted.state,
      value: extracted.value,
      formattedValue: extracted.value != null ? definition.format(extracted.value) : null,
      isBest: bestIndices.has(index),
    }));

    return { definition, cells };
  });
}
