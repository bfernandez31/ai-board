import { PREVIEW_MAX_CHARS, type NormalizedEvent } from './schema';

export type PreviewStatus = 'FAILED' | 'COMPLETED' | 'CANCELLED' | 'UNAVAILABLE' | 'PRUNED';

export const PREVIEW_UNAVAILABLE = 'Logs unavailable — capture failed.';
export const PREVIEW_PRUNED = 'Logs no longer retained (30-day window expired).';

function truncate(value: string): string {
  const collapsed = value.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= PREVIEW_MAX_CHARS) return collapsed;
  return collapsed.slice(0, PREVIEW_MAX_CHARS - 1).trimEnd() + '…';
}

function lastEventOfType<T extends NormalizedEvent['type']>(
  events: NormalizedEvent[],
  type: T
): Extract<NormalizedEvent, { type: T }> | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event && event.type === type) {
      return event as Extract<NormalizedEvent, { type: T }>;
    }
  }
  return undefined;
}

function lastMessage(events: NormalizedEvent[]): string | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event && event.type === 'message' && event.payload.text.trim().length > 0) {
      return event.payload.text;
    }
  }
  return undefined;
}

function summarizeToolUsage(events: NormalizedEvent[]): string | undefined {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (event.type === 'tool_invocation') {
      counts.set(event.payload.toolName, (counts.get(event.payload.toolName) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return undefined;
  const parts = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${name}×${count}`);
  return `Completed (tools: ${parts.join(', ')}).`;
}

export function derivePreview(
  events: NormalizedEvent[],
  status: PreviewStatus
): string {
  if (status === 'UNAVAILABLE') return PREVIEW_UNAVAILABLE;
  if (status === 'PRUNED') return PREVIEW_PRUNED;

  if (status === 'FAILED') {
    const errorEvent = lastEventOfType(events, 'error');
    if (errorEvent && errorEvent.payload.message.trim().length > 0) {
      return truncate(errorEvent.payload.message);
    }
    const message = lastMessage(events);
    if (message) {
      const tail = message.length > 200 ? message.slice(-200) : message;
      return truncate(tail);
    }
    return truncate('Job failed — no diagnostic output captured.');
  }

  if (status === 'CANCELLED') {
    const lifecycle = lastEventOfType(events, 'lifecycle');
    if (lifecycle) {
      const detail = lifecycle.payload.detail;
      const reason = detail ? `${lifecycle.payload.kind}: ${detail}` : lifecycle.payload.kind;
      return truncate(`Cancelled (${reason}).`);
    }
    return truncate('Cancelled.');
  }

  if (status === 'COMPLETED') {
    const message = lastMessage(events);
    if (message) return truncate(message);
    const tools = summarizeToolUsage(events);
    if (tools) return truncate(tools);
    return truncate('Completed with no agent output.');
  }

  return PREVIEW_UNAVAILABLE;
}
