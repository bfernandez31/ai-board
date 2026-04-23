import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import type { JobExecutionLog, JobLogAvailability, JobStatus, Prisma } from '@prisma/client';
import type {
  JobExecutionLogDetail,
  JobLogEvent,
  JobLogSummary,
  JobLogUploadRequest,
} from '@/app/lib/schemas/job-logs';
import { prisma } from '@/lib/db/client';

const MINIMUM_RETENTION_DAYS = 30;

function getRetentionDate(referenceDate: Date): Date {
  return new Date(referenceDate.getTime() + MINIMUM_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export function compressJobLogEvents(events: JobLogEvent[]): Uint8Array {
  return gzipSync(Buffer.from(JSON.stringify(events), 'utf-8')) as unknown as Uint8Array<ArrayBuffer>;
}

export function decompressJobLogEvents(artifactBytes: Uint8Array | null): JobLogEvent[] | null {
  if (!artifactBytes) {
    return null;
  }

  const content = gunzipSync(Buffer.from(artifactBytes)).toString('utf-8');
  return JSON.parse(content) as JobLogEvent[];
}

export function computeArtifactSha256(events: JobLogEvent[]): string {
  return createHash('sha256').update(JSON.stringify(events)).digest('hex');
}

type PersistArgs = {
  job: {
    id: number;
    ticketId: number;
    projectId: number;
    completedAt: Date | null;
  };
  payload: JobLogUploadRequest;
  normalized: {
    availability: JobLogAvailability;
    events: JobLogEvent[];
    summary: JobLogSummary;
    partialReason: string | null;
    unavailableReason: string | null;
  };
};

export async function upsertJobExecutionLog({
  job,
  payload,
  normalized,
}: PersistArgs): Promise<JobExecutionLog> {
  const capturedAt = payload.capturedAt ? new Date(payload.capturedAt) : new Date();
  const retentionAnchor = job.completedAt && job.completedAt > capturedAt ? job.completedAt : capturedAt;
  const retainedUntil = getRetentionDate(retentionAnchor);
  const events = normalized.availability === 'UNAVAILABLE' ? [] : normalized.events;
  const artifactBytes: Uint8Array<ArrayBuffer> | null =
    normalized.availability === 'AVAILABLE' || normalized.availability === 'PARTIAL'
      ? (compressJobLogEvents(events) as Uint8Array<ArrayBuffer>)
      : null;
  const artifactSha256 =
    payload.artifactSha256 ??
    (artifactBytes ? computeArtifactSha256(events) : null);

  const data: Prisma.JobExecutionLogUncheckedCreateInput = {
    jobId: job.id,
    projectId: job.projectId,
    ticketId: job.ticketId,
    agent: payload.agent,
    availability: normalized.availability,
    sourceFormat: payload.sourceFormat,
    summaryJson: normalized.summary,
    eventCount: events.length,
    artifactEncoding: artifactBytes ? 'gzip-json' : null,
    artifactBytes,
    artifactSha256,
    artifactSizeBytes: artifactBytes ? artifactBytes.byteLength : null,
    partialReason: normalized.partialReason,
    unavailableReason: normalized.unavailableReason,
    capturedAt,
    retainedUntil,
    prunedAt: normalized.availability === 'PRUNED' ? capturedAt : null,
  };

  const updateData: Prisma.JobExecutionLogUncheckedUpdateInput = {
    agent: payload.agent,
    availability: normalized.availability,
    sourceFormat: payload.sourceFormat,
    summaryJson: normalized.summary,
    eventCount: events.length,
    artifactEncoding: artifactBytes ? 'gzip-json' : null,
    artifactBytes,
    artifactSha256,
    artifactSizeBytes: artifactBytes ? artifactBytes.byteLength : null,
    partialReason: normalized.partialReason,
    unavailableReason: normalized.unavailableReason,
    capturedAt,
    retainedUntil,
    prunedAt: normalized.availability === 'PRUNED' ? capturedAt : null,
  };

  return prisma.jobExecutionLog.upsert({
    where: { jobId: job.id },
    create: data,
    update: updateData,
  });
}

export function toJobExecutionLogDetail(log: {
  jobId: number;
  projectId: number;
  ticketId: number;
  agent: string;
  availability: JobLogAvailability;
  capturedAt: Date;
  retainedUntil: Date;
  prunedAt: Date | null;
  partialReason: string | null;
  unavailableReason: string | null;
  summaryJson: Prisma.JsonValue;
  artifactBytes: Uint8Array | Buffer | null;
}): JobExecutionLogDetail {
  return {
    jobId: log.jobId,
    projectId: log.projectId,
    ticketId: log.ticketId,
    agent: log.agent as JobExecutionLogDetail['agent'],
    availability: log.availability,
    capturedAt: log.capturedAt.toISOString(),
    retainedUntil: log.retainedUntil.toISOString(),
    prunedAt: log.prunedAt?.toISOString() ?? null,
    partialReason: log.partialReason,
    unavailableReason: log.unavailableReason,
    summary: log.summaryJson as JobLogSummary,
    events: decompressJobLogEvents(log.artifactBytes),
  };
}

export async function pruneExpiredJobExecutionLogs(now: Date = new Date()): Promise<number> {
  const result = await prisma.jobExecutionLog.updateMany({
    where: {
      availability: { in: ['AVAILABLE', 'PARTIAL'] },
      retainedUntil: { lt: now },
      artifactBytes: { not: null },
    },
    data: {
      availability: 'PRUNED',
      artifactBytes: null,
      artifactEncoding: null,
      artifactSha256: null,
      artifactSizeBytes: null,
      prunedAt: now,
    },
  });

  return result.count;
}

export function buildUnavailableLogSummary(
  status: Extract<JobStatus, 'COMPLETED' | 'FAILED' | 'CANCELLED'>,
  reason: string | null
): JobLogSummary {
  return {
    headline: reason ?? 'Execution logs were unavailable for this job.',
    status,
    latestImportantEvents: [],
    errorReason: reason,
    partial: false,
    unavailable: true,
    pruned: false,
    capturedEventCount: 0,
  };
}
