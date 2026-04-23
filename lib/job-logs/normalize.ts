import type {
  JobLogAvailability,
  JobLogEvent,
  JobLogSummary,
  JobLogSummaryEvent,
} from '@/app/lib/schemas/job-logs';

export type ProviderEventInput = Partial<JobLogEvent> & {
  timestamp?: string | Date | null;
  type?: string | null;
  kind?: string | null;
  role?: string | null;
  actor?: string | null;
  title?: string | null;
  body?: string | null;
  message?: string | null;
  content?: string | null;
  toolName?: string | null;
  tool?: string | null;
  name?: string | null;
  metadata?: Record<string, unknown> | null;
};

type ProviderLogInput = {
  availability: JobLogAvailability;
  events?: ProviderEventInput[] | null;
  summary: JobLogSummary;
  partialReason?: string | null;
  unavailableReason?: string | null;
};

const SENSITIVE_KEY_PATTERN = /(authorization|api[-_]?key|token|secret|password|cookie|credential)/i;
const SENSITIVE_VALUE_PATTERN = /(sk-[A-Za-z0-9_-]+|ghp_[A-Za-z0-9]+|Bearer\s+[A-Za-z0-9._-]+)/gi;

function sanitizeText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.replace(SENSITIVE_VALUE_PATTERN, '[REDACTED]');
}

function sanitizeMetadata(
  metadata: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }

  const sanitizedEntries = Object.entries(metadata).flatMap(([key, value]) => {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      return [[key, '[REDACTED]']] as const;
    }

    if (typeof value === 'string') {
      return [[key, sanitizeText(value) ?? '']] as const;
    }

    return [[key, value]] as const;
  });

  return Object.fromEntries(sanitizedEntries);
}

function normalizeActor(event: ProviderEventInput): JobLogEvent['actor'] {
  const value = (event.actor ?? event.role ?? '').toLowerCase();

  if (value.includes('tool')) {
    return 'tool';
  }

  if (value.includes('system')) {
    return 'system';
  }

  return 'agent';
}

function normalizeKind(event: ProviderEventInput): JobLogEvent['kind'] {
  const rawType = (event.kind ?? event.type ?? '').toUpperCase();

  if (rawType.includes('TOOL_RESULT')) {
    return 'TOOL_RESULT';
  }

  if (rawType.includes('TOOL')) {
    return 'TOOL_CALL';
  }

  if (rawType.includes('ERROR') || rawType.includes('FAIL')) {
    return 'ERROR';
  }

  if (rawType.includes('WARN')) {
    return 'WARNING';
  }

  if (rawType.includes('STATUS') || rawType.includes('COMPLETE') || rawType.includes('CANCEL')) {
    return 'STATUS';
  }

  return 'MESSAGE';
}

function normalizeTimestamp(timestamp: unknown, fallbackIndex: number): string {
  if (
    typeof timestamp === 'object' &&
    timestamp !== null &&
    'toISOString' in timestamp &&
    typeof timestamp.toISOString === 'function'
  ) {
    return (timestamp as Date).toISOString();
  }

  if (typeof timestamp === 'string' && timestamp.length > 0) {
    return new Date(timestamp).toISOString();
  }

  return new Date(Date.UTC(1970, 0, 1, 0, 0, fallbackIndex)).toISOString();
}

function normalizeTitle(event: ProviderEventInput, kind: JobLogEvent['kind']): string {
  const toolName = event.toolName ?? event.tool ?? event.name ?? null;
  const text = sanitizeText(
    event.title ?? event.message ?? event.content ?? event.body ?? toolName ?? null
  );

  if (text) {
    return text.slice(0, 500);
  }

  switch (kind) {
    case 'TOOL_CALL':
      return 'Tool call';
    case 'TOOL_RESULT':
      return 'Tool result';
    case 'ERROR':
      return 'Error';
    case 'WARNING':
      return 'Warning';
    case 'STATUS':
      return 'Status update';
    default:
      return 'Message';
  }
}

export function normalizeProviderEvents(events: ProviderEventInput[] | null | undefined): JobLogEvent[] {
  return (events ?? []).map((event, index) => {
    const kind = normalizeKind(event);
    const bodySource =
      event.body ??
      (event.message && event.message !== event.title ? event.message : null) ??
      (event.content && event.content !== event.title ? event.content : null) ??
      null;

    return {
      sequence: event.sequence ?? index,
      timestamp: normalizeTimestamp(event.timestamp, index),
      kind,
      actor: normalizeActor(event),
      title: normalizeTitle(event, kind),
      body: sanitizeText(bodySource)?.slice(0, 50000) ?? null,
      toolName: sanitizeText(event.toolName ?? event.tool ?? event.name ?? null)?.slice(0, 200) ?? null,
      metadata: sanitizeMetadata(event.metadata),
    };
  });
}

export function buildSummaryPreviewEvents(events: JobLogEvent[], maxItems: number = 3): JobLogSummaryEvent[] {
  return events
    .filter((event) => event.kind !== 'MESSAGE' || Boolean(event.body))
    .slice(-maxItems)
    .map((event) => ({
      timestamp: event.timestamp,
      kind:
        event.kind === 'TOOL_CALL' || event.kind === 'TOOL_RESULT'
          ? 'TOOL'
          : event.kind,
      label: [event.title, event.body].filter(Boolean).join(': ').slice(0, 500),
    }));
}

export function normalizeProviderLog(input: ProviderLogInput): {
  availability: JobLogAvailability;
  events: JobLogEvent[];
  summary: JobLogSummary;
  partialReason: string | null;
  unavailableReason: string | null;
} {
  const events = normalizeProviderEvents(input.events);
  const previewEvents =
    input.summary.latestImportantEvents.length > 0
      ? input.summary.latestImportantEvents
      : buildSummaryPreviewEvents(events);

  return {
    availability: input.availability,
    events,
    summary: {
      ...input.summary,
      latestImportantEvents: previewEvents,
      capturedEventCount: events.length || input.summary.capturedEventCount,
      partial: input.availability === 'PARTIAL' || input.summary.partial,
      unavailable: input.availability === 'UNAVAILABLE' || input.summary.unavailable,
      pruned: input.availability === 'PRUNED' || input.summary.pruned,
    },
    partialReason: input.partialReason ?? null,
    unavailableReason: input.unavailableReason ?? null,
  };
}
