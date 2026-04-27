import { describe, it, expect } from 'vitest';
import {
  normalizeClaude,
  normalizeCodex,
  normalizeMistral,
  normalizeGemini,
} from '@/app/lib/logs/normalizer';

const baseInput = {
  jobId: 4321,
  startedAt: '2026-04-22T10:00:00.000Z',
  endedAt: '2026-04-22T10:02:15.120Z',
};

describe('normalizeClaude', () => {
  it('produces a v1 header and lifecycle bookends', () => {
    const claudeFixture = JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello there.' }],
      },
    });
    const out = normalizeClaude({ ...baseInput, raw: claudeFixture });
    expect(out.header).toEqual({
      schemaVersion: 1,
      agent: 'CLAUDE',
      jobId: 4321,
      startedAt: baseInput.startedAt,
      endedAt: baseInput.endedAt,
    });
    expect(out.events[0]?.type).toBe('lifecycle');
    expect(out.events[out.events.length - 1]?.type).toBe('lifecycle');
  });

  it('parses tool_use and text blocks in stream order', () => {
    const lines = [
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'tu_1', name: 'Bash', input: { command: 'ls' } },
          ],
        },
      }),
      JSON.stringify({
        type: 'user',
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: 'a b c', is_error: false }],
        },
      }),
    ].join('\n');
    const out = normalizeClaude({ ...baseInput, raw: lines });
    const inner = out.events.slice(1, -1);
    expect(inner[0]?.type).toBe('tool_invocation');
    expect(inner[1]?.type).toBe('tool_result');
  });

  it('preserves the native timestamp when the event provides one', () => {
    const ts = '2026-04-14T18:35:35.095Z';
    const raw = JSON.stringify({
      type: 'assistant',
      timestamp: ts,
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'hello' }],
      },
    });
    const out = normalizeClaude({ ...baseInput, raw });
    const message = out.events.find((e) => e.type === 'message');
    expect(message?.ts).toBe(ts);
  });

  it('handles user messages whose content is a plain string', () => {
    const raw = JSON.stringify({
      type: 'user',
      message: { role: 'user', content: 'sauvegarde le docker compose' },
    });
    const out = normalizeClaude({ ...baseInput, raw });
    const message = out.events.find((e) => e.type === 'message');
    expect(message).toBeDefined();
    expect(message?.payload).toMatchObject({ role: 'user', text: 'sauvegarde le docker compose' });
  });

  it('skips isMeta caveats and file-history snapshots', () => {
    const lines = [
      JSON.stringify({ type: 'file-history-snapshot', snapshot: { trackedFileBackups: {} } }),
      JSON.stringify({
        type: 'user',
        isMeta: true,
        message: { role: 'user', content: '<local-command-caveat>...' },
      }),
      JSON.stringify({
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'text', text: 'real reply' }] },
      }),
    ].join('\n');
    const out = normalizeClaude({ ...baseInput, raw: lines });
    const inner = out.events.slice(1, -1);
    expect(inner).toHaveLength(1);
    expect(inner[0]?.payload).toMatchObject({ text: 'real reply' });
  });
});

describe('normalizeCodex', () => {
  it('parses tool_call and tool_result with lifecycle bookends', () => {
    const lines = [
      JSON.stringify({ tool: { name: 'Bash', id: 't1', input: { cmd: 'pwd' } } }),
      JSON.stringify({ result: { id: 't1', output: '/home', error: false } }),
      JSON.stringify({ role: 'assistant', content: 'Done.' }),
    ].join('\n');
    const out = normalizeCodex({ ...baseInput, raw: lines });
    expect(out.header.agent).toBe('CODEX');
    expect(out.events[0]?.type).toBe('lifecycle');
    const types = out.events.map((e) => e.type);
    expect(types).toContain('tool_invocation');
    expect(types).toContain('tool_result');
    expect(types).toContain('message');
    expect(out.events[out.events.length - 1]?.type).toBe('lifecycle');
  });
});

describe('normalizeMistral', () => {
  it('parses tool_call/tool_result and text events', () => {
    const lines = [
      JSON.stringify({ kind: 'tool_call', tool_name: 'Edit', tool_call_id: 'mc1', tool_input: { path: 'a' } }),
      JSON.stringify({ kind: 'tool_result', tool_call_id: 'mc1', tool_output: 'ok', is_error: false }),
      JSON.stringify({ role: 'assistant', text: 'Done.' }),
    ].join('\n');
    const out = normalizeMistral({ ...baseInput, raw: lines });
    expect(out.header.agent).toBe('MISTRAL');
    const types = out.events.map((e) => e.type);
    expect(types).toContain('tool_invocation');
    expect(types).toContain('tool_result');
    expect(types).toContain('message');
  });
});

describe('normalizeGemini', () => {
  it('parses parts with text/functionCall/functionResponse', () => {
    const lines = [
      JSON.stringify({
        role: 'user',
        parts: [{ text: 'go ahead' }],
      }),
      JSON.stringify({
        role: 'model',
        parts: [
          { functionCall: { name: 'Search', args: { q: 'foo' } } },
          { functionResponse: { name: 'Search', response: { hits: 0 } } },
          { text: 'No results.' },
        ],
      }),
    ].join('\n');
    const out = normalizeGemini({ ...baseInput, raw: lines });
    expect(out.header.agent).toBe('GEMINI');
    const innerTypes = out.events.slice(1, -1).map((e) => e.type);
    expect(innerTypes).toEqual(
      expect.arrayContaining(['message', 'tool_invocation', 'tool_result', 'message'])
    );
  });
});

describe('empty raw input produces minimal lifecycle pair', () => {
  it('returns started + cancelled when ended is null', () => {
    const out = normalizeClaude({ jobId: 1, startedAt: baseInput.startedAt, endedAt: null, raw: '' });
    expect(out.events).toHaveLength(2);
    expect(out.events[0]?.type).toBe('lifecycle');
    expect(out.events[1]?.type).toBe('lifecycle');
  });
});
