/**
 * Unit tests for agent log normalization.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeAgentLog,
  MAX_LOG_CONTENT_BYTES,
  MAX_SUMMARY_CHARS,
} from '@/lib/logs/normalize';

describe('normalizeAgentLog', () => {
  it('returns an empty shell for empty input', () => {
    const result = normalizeAgentLog('');
    expect(result.content).toBe('');
    expect(result.summary).toBe('');
    expect(result.truncated).toBe(false);
    expect(result.byteSize).toBe(0);
    expect(result.eventCount).toBe(0);
  });

  it('preserves plain-text log lines and builds a tail summary', () => {
    const raw = ['Starting agent', 'Ran tool bash', 'Finished successfully'].join('\n');
    const result = normalizeAgentLog(raw);

    expect(result.content).toContain('Starting agent');
    expect(result.content).toContain('Finished successfully');
    expect(result.summary).toContain('Finished successfully');
    expect(result.truncated).toBe(false);
    expect(result.byteSize).toBe(raw.length);
  });

  it('strips ANSI escape codes', () => {
    const raw = '[31mred error[0m after reset';
    const result = normalizeAgentLog(raw);
    expect(result.content).not.toContain('[');
    expect(result.content).toContain('red error');
  });

  it('renders Claude-style stream-json events as human lines', () => {
    const events = [
      JSON.stringify({
        type: 'assistant',
        timestamp: '2026-04-23T10:00:00Z',
        message: {
          content: [
            { type: 'text', text: 'Reading file' },
            { type: 'tool_use', name: 'Read' },
          ],
        },
      }),
      JSON.stringify({
        type: 'tool_use',
        timestamp: '2026-04-23T10:00:01Z',
        name: 'Bash',
      }),
    ].join('\n');

    const result = normalizeAgentLog(events, { agent: 'CLAUDE' });
    expect(result.agent).toBe('CLAUDE');
    expect(result.eventCount).toBe(2);
    expect(result.content).toContain('assistant: Reading file');
    expect(result.content).toContain('[tool] Read');
    expect(result.content).toContain('tool_use: Bash');
    expect(result.content).not.toContain('"type":"assistant"');
  });

  it('prefers an error line for summary when one exists', () => {
    const raw = [
      'Starting',
      'Progressing',
      'ERROR: build failed — exit code 1',
      'Cleanup done',
    ].join('\n');
    const result = normalizeAgentLog(raw);
    expect(result.summary).toContain('ERROR');
    expect(result.summary).toContain('build failed');
  });

  it('truncates content that exceeds the 1MB cap but keeps the tail', () => {
    const big = 'a'.repeat(MAX_LOG_CONTENT_BYTES + 4096);
    const tailMarker = '\nTAIL_MARKER_VISIBLE';
    const result = normalizeAgentLog(big + tailMarker);
    expect(result.truncated).toBe(true);
    expect(result.content.length).toBeLessThanOrEqual(MAX_LOG_CONTENT_BYTES + 200);
    expect(result.content).toContain('TAIL_MARKER_VISIBLE');
    expect(result.content).toContain('truncated');
  });

  it('caps summary length at MAX_SUMMARY_CHARS', () => {
    const long = 'word '.repeat(400);
    const result = normalizeAgentLog(long);
    expect(result.summary.length).toBeLessThanOrEqual(MAX_SUMMARY_CHARS);
  });

  it('detects the agent family from the raw stream when not provided', () => {
    expect(normalizeAgentLog('Codex CLI installed').agent).toBe('CODEX');
    expect(normalizeAgentLog('vibe CLI spawned').agent).toBe('MISTRAL');
    expect(normalizeAgentLog('gemini_cli invocation').agent).toBe('GEMINI');
    expect(normalizeAgentLog('plain text').agent).toBe('UNKNOWN');
  });

  it('respects the explicit agent option over auto-detect', () => {
    const result = normalizeAgentLog('gemini_cli trace', { agent: 'CLAUDE' });
    expect(result.agent).toBe('CLAUDE');
  });
});
