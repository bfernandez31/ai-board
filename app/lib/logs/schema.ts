import { z } from 'zod';

export const SCHEMA_VERSION = 1 as const;
export const PREVIEW_MAX_CHARS = 280;
export const PREVIEW_INPUT_MAX_CHARS = 4096;
export const ARTIFACT_MAX_BYTES = 25 * 1024 * 1024;

export const AgentIdSchema = z.enum(['CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI']);
export type AgentId = z.infer<typeof AgentIdSchema>;

export const EventTypeSchema = z.enum([
  'message',
  'tool_invocation',
  'tool_result',
  'error',
  'lifecycle',
]);
export type EventType = z.infer<typeof EventTypeSchema>;

const messagePayload = z.object({
  role: z.enum(['agent', 'user', 'system']),
  text: z.string(),
  thinking: z.string().optional(),
});

const toolInvocationPayload = z.object({
  toolName: z.string(),
  toolCallId: z.string(),
  input: z.unknown(),
});

const toolResultPayload = z.object({
  toolCallId: z.string(),
  output: z.unknown(),
  isError: z.boolean(),
});

const errorPayload = z.object({
  message: z.string(),
  stack: z.string().optional(),
});

const lifecyclePayload = z.object({
  kind: z.enum([
    'started',
    'completed',
    'cancelled',
    'timeout',
    'upstream_error',
  ]),
  detail: z.string().optional(),
});

export const NormalizedEventSchema = z.discriminatedUnion('type', [
  z.object({ ts: z.string(), type: z.literal('message'), agent: AgentIdSchema, payload: messagePayload }),
  z.object({ ts: z.string(), type: z.literal('tool_invocation'), agent: AgentIdSchema, payload: toolInvocationPayload }),
  z.object({ ts: z.string(), type: z.literal('tool_result'), agent: AgentIdSchema, payload: toolResultPayload }),
  z.object({ ts: z.string(), type: z.literal('error'), agent: AgentIdSchema, payload: errorPayload }),
  z.object({ ts: z.string(), type: z.literal('lifecycle'), agent: AgentIdSchema, payload: lifecyclePayload }),
]);
export type NormalizedEvent = z.infer<typeof NormalizedEventSchema>;

export const ArtifactHeaderSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  agent: AgentIdSchema,
  jobId: z.number().int().positive(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
});
export type ArtifactHeader = z.infer<typeof ArtifactHeaderSchema>;

export const CaptureStatusWriteSchema = z.enum(['CAPTURED', 'UNAVAILABLE']);
export type CaptureStatusWrite = z.infer<typeof CaptureStatusWriteSchema>;

const baseSubmission = z.object({
  captureStatus: CaptureStatusWriteSchema,
  preview: z.string().min(1).max(PREVIEW_INPUT_MAX_CHARS),
  schemaVersion: z.literal(SCHEMA_VERSION),
  eventCount: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  artifactKey: z.string().max(300).optional(),
  artifactSize: z.number().int().positive().optional(),
});

export const JobLogSubmissionSchema = baseSubmission.refine(
  (data) => data.errorCount <= data.eventCount,
  { message: 'errorCount must not exceed eventCount', path: ['errorCount'] }
).refine(
  (data) => {
    if (data.captureStatus === 'CAPTURED') {
      return typeof data.artifactKey === 'string' && typeof data.artifactSize === 'number';
    }
    return data.artifactKey === undefined && data.artifactSize === undefined;
  },
  {
    message:
      'artifactKey and artifactSize are required when captureStatus is CAPTURED, and forbidden otherwise',
    path: ['artifactKey'],
  }
);

export type JobLogSubmission = z.infer<typeof JobLogSubmissionSchema>;
