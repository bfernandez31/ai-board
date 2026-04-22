import { describe, it, expect } from 'vitest';
import { redactString, redactEvents } from '@/app/lib/logs/redactor';
import type { NormalizedEvent } from '@/app/lib/logs/schema';

describe('redactString', () => {
  it('redacts classic personal access tokens', () => {
    const input = 'token=ghp_1234567890abcdefghij';
    const out = redactString(input);
    expect(out).toContain('[REDACTED:github_token]');
    expect(out).not.toContain('ghp_1234567890abcdefghij');
  });

  it('redacts fine-grained github_pat tokens', () => {
    const input = 'GH=github_pat_AAAAAAAAAAAAAAAAAAAAAA_BBBBBB';
    const out = redactString(input);
    expect(out).toContain('[REDACTED:github_token]');
  });

  it('redacts Bearer authorization values', () => {
    const input = 'Authorization: Bearer abc.def-ghi_jklmno';
    const out = redactString(input);
    expect(out).toBe('Authorization: Bearer [REDACTED:bearer]');
  });

  it('redacts private key blocks', () => {
    const input =
      '-----BEGIN PRIVATE KEY-----\nMIIBVQIBADANBgkq\n-----END PRIVATE KEY-----';
    const out = redactString(input);
    expect(out).toBe('[REDACTED:private_key]');
  });

  it('redacts Anthropic keys', () => {
    const input = 'use sk-ant-api03-AAAAAAAAAAAAAAAAAAAA today';
    const out = redactString(input);
    expect(out).toContain('[REDACTED:anthropic_key]');
  });

  it('redacts OpenAI keys', () => {
    const input = 'sk-AAAAAAAAAAAAAAAAAAAAAAAA';
    const out = redactString(input);
    expect(out).toContain('[REDACTED:openai_key]');
  });

  it('redacts Google API keys', () => {
    const input = 'key=AIzaSyA-AAAAAAAAAAAAAAAAAAA';
    const out = redactString(input);
    expect(out).toContain('[REDACTED:google_key]');
  });

  it('redacts environment-style key=value secrets and keeps the key visible', () => {
    const input = 'MY_API_TOKEN=abcdefghijklmnopqrstuvwxyz1234567890';
    const out = redactString(input);
    expect(out).toContain('MY_API_TOKEN=[REDACTED:env_secret:MY_API_TOKEN]');
  });

  it('emits the literal placeholder format', () => {
    const out = redactString('Authorization: Bearer xxxxxxxxxxxxxxxx');
    expect(out).toMatch(/^Authorization: Bearer \[REDACTED:bearer\]$/);
  });

  it('returns the original string when no patterns match', () => {
    expect(redactString('hello world')).toBe('hello world');
  });
});

describe('redactEvents deep visitor', () => {
  it('redacts nested tool_invocation.input strings', () => {
    const events: NormalizedEvent[] = [
      {
        ts: '2026-04-22T10:00:00.000Z',
        type: 'tool_invocation',
        agent: 'CLAUDE',
        payload: {
          toolName: 'Bash',
          toolCallId: 'call-1',
          input: {
            command: 'curl -H "Authorization: Bearer abcdef.ghijkl_mnopqr"',
            env: { GITHUB_TOKEN: 'ghp_1234567890abcdefghij' },
          },
        },
      },
    ];
    const [out] = redactEvents(events);
    expect(out).toBeDefined();
    if (out?.type !== 'tool_invocation') throw new Error('wrong type');
    const input = out.payload.input as { command: string; env: { GITHUB_TOKEN: string } };
    expect(input.command).toContain('[REDACTED:bearer]');
    expect(input.env.GITHUB_TOKEN).toContain('[REDACTED:github_token]');
  });

  it('redacts tool_result.output recursively', () => {
    const events: NormalizedEvent[] = [
      {
        ts: '2026-04-22T10:00:01.000Z',
        type: 'tool_result',
        agent: 'CLAUDE',
        payload: {
          toolCallId: 'call-1',
          output: { stdout: 'token=ghp_1234567890abcdefghij' },
          isError: false,
        },
      },
    ];
    const [out] = redactEvents(events);
    if (out?.type !== 'tool_result') throw new Error('wrong type');
    const payloadOutput = out.payload.output as { stdout: string };
    expect(payloadOutput.stdout).toContain('[REDACTED:github_token]');
  });

  it('redacts message text and thinking fields', () => {
    const events: NormalizedEvent[] = [
      {
        ts: '2026-04-22T10:00:02.000Z',
        type: 'message',
        agent: 'CLAUDE',
        payload: {
          role: 'agent',
          text: 'sk-ant-api03-AAAAAAAAAAAAAAAAAAAA',
          thinking: 'I will use Authorization: Bearer abcdef.ghijkl_mnopqr',
        },
      },
    ];
    const [out] = redactEvents(events);
    if (out?.type !== 'message') throw new Error('wrong type');
    expect(out.payload.text).toContain('[REDACTED:anthropic_key]');
    expect(out.payload.thinking).toContain('[REDACTED:bearer]');
  });

  it('preserves non-string scalars in nested payloads', () => {
    const events: NormalizedEvent[] = [
      {
        ts: '2026-04-22T10:00:03.000Z',
        type: 'tool_invocation',
        agent: 'CLAUDE',
        payload: {
          toolName: 'Read',
          toolCallId: 'call-2',
          input: { offset: 100, limit: 50, recursive: true, paths: null },
        },
      },
    ];
    const [out] = redactEvents(events);
    if (out?.type !== 'tool_invocation') throw new Error('wrong type');
    expect(out.payload.input).toEqual({ offset: 100, limit: 50, recursive: true, paths: null });
  });
});
