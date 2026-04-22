import { describe, it, expect } from 'vitest';
import {
  derivePreview,
  PREVIEW_UNAVAILABLE,
  PREVIEW_PRUNED,
} from '@/app/lib/logs/preview';
import { PREVIEW_MAX_CHARS, type NormalizedEvent } from '@/app/lib/logs/schema';

const ts = '2026-04-22T10:00:00.000Z';

const lifecycleStart: NormalizedEvent = {
  ts,
  type: 'lifecycle',
  agent: 'CLAUDE',
  payload: { kind: 'started' },
};

describe('derivePreview', () => {
  it('FAILED — prefers terminal error message', () => {
    const events: NormalizedEvent[] = [
      lifecycleStart,
      {
        ts,
        type: 'message',
        agent: 'CLAUDE',
        payload: { role: 'agent', text: 'attempting tool call' },
      },
      {
        ts,
        type: 'error',
        agent: 'CLAUDE',
        payload: { message: 'Bash command failed: exit 1' },
      },
    ];
    expect(derivePreview(events, 'FAILED')).toBe('Bash command failed: exit 1');
  });

  it('FAILED — falls back to last message when error has empty text', () => {
    const tail = 'Final assistant message before crash. '.repeat(10);
    const events: NormalizedEvent[] = [
      lifecycleStart,
      {
        ts,
        type: 'message',
        agent: 'CLAUDE',
        payload: { role: 'agent', text: tail },
      },
    ];
    const out = derivePreview(events, 'FAILED');
    expect(out.length).toBeLessThanOrEqual(PREVIEW_MAX_CHARS);
    expect(out).toContain('Final assistant message');
  });

  it('FAILED — truncates over-long error to 280 chars with ellipsis', () => {
    const huge = 'x'.repeat(500);
    const events: NormalizedEvent[] = [
      lifecycleStart,
      { ts, type: 'error', agent: 'CLAUDE', payload: { message: huge } },
    ];
    const out = derivePreview(events, 'FAILED');
    expect(out.length).toBe(PREVIEW_MAX_CHARS);
    expect(out.endsWith('…')).toBe(true);
  });

  it('UNAVAILABLE — returns the literal string regardless of events', () => {
    expect(derivePreview([], 'UNAVAILABLE')).toBe(PREVIEW_UNAVAILABLE);
  });

  it('PRUNED — returns the literal string', () => {
    expect(derivePreview([], 'PRUNED')).toBe(PREVIEW_PRUNED);
  });

  it('CANCELLED — surfaces lifecycle kind/detail', () => {
    const events: NormalizedEvent[] = [
      lifecycleStart,
      {
        ts,
        type: 'lifecycle',
        agent: 'CLAUDE',
        payload: { kind: 'cancelled', detail: 'user-cancelled' },
      },
    ];
    const out = derivePreview(events, 'CANCELLED');
    expect(out).toBe('Cancelled (cancelled: user-cancelled).');
  });

  it('COMPLETED — returns the final agent message', () => {
    const events: NormalizedEvent[] = [
      lifecycleStart,
      {
        ts,
        type: 'message',
        agent: 'CLAUDE',
        payload: { role: 'agent', text: 'All tasks complete.' },
      },
    ];
    expect(derivePreview(events, 'COMPLETED')).toBe('All tasks complete.');
  });

  it('COMPLETED — falls back to tool usage recap when no message', () => {
    const events: NormalizedEvent[] = [
      lifecycleStart,
      {
        ts,
        type: 'tool_invocation',
        agent: 'CLAUDE',
        payload: { toolName: 'Bash', toolCallId: 't1', input: {} },
      },
      {
        ts,
        type: 'tool_invocation',
        agent: 'CLAUDE',
        payload: { toolName: 'Bash', toolCallId: 't2', input: {} },
      },
    ];
    const out = derivePreview(events, 'COMPLETED');
    expect(out).toContain('Completed');
    expect(out).toContain('Bash×2');
  });

  it('hard caps every branch at 280 chars', () => {
    const huge = 'y'.repeat(2000);
    const events: NormalizedEvent[] = [
      lifecycleStart,
      { ts, type: 'message', agent: 'CLAUDE', payload: { role: 'agent', text: huge } },
    ];
    for (const status of ['FAILED', 'COMPLETED'] as const) {
      const out = derivePreview(events, status);
      expect(out.length).toBeLessThanOrEqual(PREVIEW_MAX_CHARS);
    }
  });
});
