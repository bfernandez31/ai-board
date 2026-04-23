import { z } from 'zod';

const jobLogAvailabilityValues = ['AVAILABLE', 'PARTIAL', 'UNAVAILABLE', 'PRUNED'] as const;
const jobLogStatusValues = ['COMPLETED', 'FAILED', 'CANCELLED'] as const;
const jobLogSummaryEventKindValues = ['MESSAGE', 'TOOL', 'WARNING', 'ERROR', 'STATUS'] as const;
const jobLogEventKindValues = [
  'MESSAGE',
  'TOOL_CALL',
  'TOOL_RESULT',
  'WARNING',
  'ERROR',
  'STATUS',
] as const;
const jobLogEventActorValues = ['agent', 'tool', 'system'] as const;
const agentValues = ['CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI'] as const;

export const JobLogAvailabilitySchema = z.enum(jobLogAvailabilityValues);
export const JobLogStatusSchema = z.enum(jobLogStatusValues);
export const JobLogSummaryEventKindSchema = z.enum(jobLogSummaryEventKindValues);
export const JobLogEventKindSchema = z.enum(jobLogEventKindValues);
export const JobLogEventActorSchema = z.enum(jobLogEventActorValues);
export const JobLogAgentSchema = z.enum(agentValues);

export const JobLogSummaryEventSchema = z.object({
  timestamp: z.string().datetime(),
  kind: JobLogSummaryEventKindSchema,
  label: z.string().min(1).max(500),
});

export const JobLogSummarySchema = z.object({
  headline: z.string().min(1).max(500),
  status: JobLogStatusSchema,
  latestImportantEvents: z.array(JobLogSummaryEventSchema).max(5),
  errorReason: z.string().max(500).nullable(),
  partial: z.boolean(),
  unavailable: z.boolean(),
  pruned: z.boolean(),
  capturedEventCount: z.number().int().min(0),
});

export const JobLogEventSchema = z.object({
  sequence: z.number().int().min(0),
  timestamp: z.string().datetime(),
  kind: JobLogEventKindSchema,
  actor: JobLogEventActorSchema,
  title: z.string().min(1).max(500),
  body: z.string().max(50000).nullable(),
  toolName: z.string().max(200).nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

export const JobLogUploadRequestSchema = z.object({
  agent: JobLogAgentSchema,
  sourceFormat: z.string().min(1).max(100),
  availability: JobLogAvailabilitySchema,
  capturedAt: z.string().datetime().optional(),
  summary: JobLogSummarySchema,
  events: z.array(JobLogEventSchema).optional(),
  partialReason: z.string().max(500).nullable().optional(),
  unavailableReason: z.string().max(500).nullable().optional(),
  artifactSha256: z.string().length(64).nullable().optional(),
});

export const JobLogUploadResponseSchema = z.object({
  jobId: z.number().int().positive(),
  availability: JobLogAvailabilitySchema,
  capturedAt: z.string().datetime(),
  retainedUntil: z.string().datetime(),
});

export const JobExecutionLogDetailSchema = z.object({
  jobId: z.number().int().positive(),
  projectId: z.number().int().positive(),
  ticketId: z.number().int().positive(),
  agent: JobLogAgentSchema,
  availability: JobLogAvailabilitySchema,
  capturedAt: z.string().datetime().nullable(),
  retainedUntil: z.string().datetime().nullable(),
  prunedAt: z.string().datetime().nullable(),
  partialReason: z.string().nullable(),
  unavailableReason: z.string().nullable(),
  summary: JobLogSummarySchema,
  events: z.array(JobLogEventSchema).nullable(),
});

export const JobLogErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
});

export type JobLogAvailability = z.infer<typeof JobLogAvailabilitySchema>;
export type JobLogStatus = z.infer<typeof JobLogStatusSchema>;
export type JobLogAgent = z.infer<typeof JobLogAgentSchema>;
export type JobLogSummaryEvent = z.infer<typeof JobLogSummaryEventSchema>;
export type JobLogSummary = z.infer<typeof JobLogSummarySchema>;
export type JobLogEvent = z.infer<typeof JobLogEventSchema>;
export type JobLogUploadRequest = z.infer<typeof JobLogUploadRequestSchema>;
export type JobLogUploadResponse = z.infer<typeof JobLogUploadResponseSchema>;
export type JobExecutionLogDetail = z.infer<typeof JobExecutionLogDetailSchema>;
