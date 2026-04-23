import { describe, expect, it } from 'vitest';
import { normalizeProviderEvents, normalizeProviderLog } from '@/lib/job-logs/normalize';
import { buildLogSummary } from '@/lib/job-logs/summary';

describe('job log normalizer', () => {
  it('normalizes mixed provider event shapes and redacts secrets', () => {
    const events = normalizeProviderEvents([
      {
        timestamp: '2026-04-23T00:00:00.000Z',
        type: 'tool_result',
        actor: 'tool',
        title: 'Read config',
        body: 'Authorization: Bearer sk-secret-token',
        tool: 'read_file',
      },
      {
        timestamp: '2026-04-23T00:00:01.000Z',
        type: 'error',
        message: 'Patch failed',
        metadata: {
          authorization: 'Bearer abc123',
        },
      },
    ]);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      kind: 'TOOL_RESULT',
      actor: 'tool',
      toolName: 'read_file',
    });
    expect(events[0]?.body).toContain('[REDACTED]');
    expect(events[1]?.metadata).toEqual({ authorization: '[REDACTED]' });
  });

  it('builds a bounded summary preview from normalized events', () => {
    const normalized = normalizeProviderLog({
      availability: 'PARTIAL',
      summary: {
        headline: 'Initial headline',
        status: 'FAILED',
        latestImportantEvents: [],
        errorReason: null,
        partial: false,
        unavailable: false,
        pruned: false,
        capturedEventCount: 0,
      },
      events: [
        {
          sequence: 0,
          timestamp: '2026-04-23T00:00:00.000Z',
          kind: 'MESSAGE',
          actor: 'agent',
          title: 'Opened repository',
          body: 'Inspecting files',
          metadata: null,
        },
        {
          sequence: 1,
          timestamp: '2026-04-23T00:00:01.000Z',
          kind: 'ERROR',
          actor: 'system',
          title: 'Tests failed',
          body: 'Expected 200 but received 500',
          metadata: null,
        },
      ],
      partialReason: 'Runner exited unexpectedly',
      unavailableReason: null,
    });

    const summary = buildLogSummary({
      availability: normalized.availability,
      status: normalized.summary.status,
      events: normalized.events,
      partialReason: normalized.partialReason,
    });

    expect(normalized.summary.partial).toBe(true);
    expect(normalized.summary.latestImportantEvents).toHaveLength(2);
    expect(summary.errorReason).toContain('Runner exited unexpectedly');
  });
});
