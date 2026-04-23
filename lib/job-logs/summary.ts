import type { JobLogAvailability, JobLogEvent, JobLogStatus, JobLogSummary } from '@/app/lib/schemas/job-logs';
import { buildSummaryPreviewEvents } from '@/lib/job-logs/normalize';

type BuildLogSummaryInput = {
  availability: JobLogAvailability;
  status: JobLogStatus;
  events: JobLogEvent[];
  partialReason?: string | null;
  unavailableReason?: string | null;
  headline?: string | null;
  errorReason?: string | null;
};

function defaultHeadline(status: JobLogStatus, availability: JobLogAvailability, errorReason: string | null): string {
  if (availability === 'UNAVAILABLE') {
    return 'Execution logs were not captured for this job.';
  }

  if (availability === 'PRUNED') {
    return 'Execution logs were captured and later pruned after retention.';
  }

  if (status === 'FAILED' && errorReason) {
    return `Job failed: ${errorReason}`;
  }

  if (status === 'FAILED') {
    return 'Job failed during execution.';
  }

  if (status === 'CANCELLED') {
    return 'Job was cancelled before completion.';
  }

  return 'Job completed successfully.';
}

export function buildLogSummary(input: BuildLogSummaryInput): JobLogSummary {
  const errorEvent = [...input.events].reverse().find((event) => event.kind === 'ERROR');
  const derivedErrorReason =
    input.errorReason ??
    input.partialReason ??
    input.unavailableReason ??
    errorEvent?.body ??
    errorEvent?.title ??
    null;

  return {
    headline:
      input.headline?.slice(0, 500) ??
      defaultHeadline(input.status, input.availability, derivedErrorReason),
    status: input.status,
    latestImportantEvents: buildSummaryPreviewEvents(input.events, 3),
    errorReason: derivedErrorReason?.slice(0, 500) ?? null,
    partial: input.availability === 'PARTIAL',
    unavailable: input.availability === 'UNAVAILABLE',
    pruned: input.availability === 'PRUNED',
    capturedEventCount: input.events.length,
  };
}
