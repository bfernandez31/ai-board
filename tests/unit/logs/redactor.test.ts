import { describe, it, expect } from 'vitest';
import { redactString, redactEvents, redactNativeJsonl } from '@/app/lib/logs/redactor';
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

  it('redacts DATABASE_URL connection strings with credentials', () => {
    const input = 'DATABASE_URL=postgres://user:s3cret@db.example.com:5432/appdb';
    const out = redactString(input);
    expect(out).toBe('DATABASE_URL=[REDACTED:env_secret:DATABASE_URL]');
    expect(out).not.toContain('s3cret');
    expect(out).not.toContain('db.example.com');
  });

  it('redacts REDIS_URL connection strings', () => {
    const input = 'REDIS_URL="redis://:mypassword@redis.internal:6379/0"';
    const out = redactString(input);
    expect(out).toContain('REDIS_URL=[REDACTED:env_secret:REDIS_URL]');
    expect(out).not.toContain('mypassword');
  });

  it('redacts SENTRY_DSN values', () => {
    const input = 'SENTRY_DSN=https://abc123def456@o123.ingest.sentry.io/789';
    const out = redactString(input);
    expect(out).toContain('SENTRY_DSN=[REDACTED:env_secret:SENTRY_DSN]');
    expect(out).not.toContain('abc123def456');
  });

  it('redacts generic CONNECTION_STRING env vars', () => {
    const input = 'MONGO_CONNECTION=mongodb://admin:topsecret@cluster0.mongodb.net/db';
    const out = redactString(input);
    expect(out).toContain('MONGO_CONNECTION=[REDACTED:env_secret:MONGO_CONNECTION]');
    expect(out).not.toContain('topsecret');
  });

  it('redacts realistic Mistral API key output via env-secret coverage', () => {
    const input = 'stderr: MISTRAL_API_KEY=abcd1234abcd1234abcd1234abcd1234';
    const out = redactString(input);
    expect(out).toContain('MISTRAL_API_KEY=[REDACTED:env_secret:MISTRAL_API_KEY]');
    expect(out).not.toContain('abcd1234abcd1234abcd1234abcd1234');
  });

  it('does not bleed across whitespace to adjacent env vars', () => {
    const input = 'DATABASE_URL=postgres://u:p@h/d NEXTAUTH_SECRET=abcdefghijklmnopqrstuvwxyz1234567890';
    const out = redactString(input);
    expect(out).toContain('DATABASE_URL=[REDACTED:env_secret:DATABASE_URL]');
    expect(out).toContain('NEXTAUTH_SECRET=[REDACTED:env_secret:NEXTAUTH_SECRET]');
    expect(out).not.toContain('abcdefghijklmnopqrstuvwxyz1234567890');
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

describe('redactNativeJsonl', () => {
  it('returns empty/whitespace input unchanged', () => {
    expect(redactNativeJsonl('')).toBe('');
    expect(redactNativeJsonl('   ')).toBe('   ');
  });

  it('redacts top-level string token field on a parsed object', () => {
    const line = JSON.stringify({
      type: 'user',
      uuid: 'u-1',
      content: 'token=ghp_1234567890abcdefghij',
    });
    const out = redactNativeJsonl(line);
    const parsed = JSON.parse(out);
    expect(parsed.content).toContain('[REDACTED:github_token]');
    expect(parsed.content).not.toContain('ghp_1234567890abcdefghij');
    expect(parsed.uuid).toBe('u-1');
  });

  it('redacts deeply nested tool_input string with API key', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            id: 'tool-1',
            name: 'Bash',
            tool_input: {
              env: { ANTHROPIC_API_KEY: 'sk-ant-api03-AAAAAAAAAAAAAAAAAAAA' },
              cmd: 'curl',
            },
          },
        ],
      },
    });
    const out = redactNativeJsonl(line);
    const parsed = JSON.parse(out);
    expect(parsed.message.content[0].tool_input.env.ANTHROPIC_API_KEY).toBe(
      '[REDACTED:anthropic_key]',
    );
    expect(parsed.message.content[0].tool_input.cmd).toBe('curl');
  });

  it('redacts KEY=VALUE env-secret strings inside summary events', () => {
    const line = JSON.stringify({
      type: 'summary',
      summary: 'Final env: MY_API_TOKEN=abcdefghijklmnopqrstuvwxyz1234567890',
      leafUuid: 'leaf-1',
    });
    const out = redactNativeJsonl(line);
    const parsed = JSON.parse(out);
    expect(parsed.summary).toContain('MY_API_TOKEN=[REDACTED:env_secret:MY_API_TOKEN]');
    expect(parsed.summary).not.toContain('abcdefghijklmnopqrstuvwxyz1234567890');
  });

  it('redacts unknown native event types via type-agnostic deepRedact', () => {
    const line = JSON.stringify({
      type: 'totally_unknown_native_event',
      depth: { deeper: { token: 'ghp_1234567890abcdefghij' } },
    });
    const out = redactNativeJsonl(line);
    const parsed = JSON.parse(out);
    expect(parsed.depth.deeper.token).toBe('[REDACTED:github_token]');
  });

  it('falls back to redactString on malformed JSON without throwing', () => {
    const malformed = 'not-json: ghp_1234567890abcdefghij';
    const out = redactNativeJsonl(malformed);
    expect(out).toContain('[REDACTED:github_token]');
    expect(out).not.toContain('ghp_1234567890abcdefghij');
  });

  it('preserves non-string scalar JSON values unchanged', () => {
    expect(redactNativeJsonl('123')).toBe('123');
    expect(redactNativeJsonl('true')).toBe('true');
    expect(redactNativeJsonl('null')).toBe('null');
  });

  it('redacts a top-level JSON string scalar', () => {
    const line = JSON.stringify('Authorization: Bearer abc.def-ghi_jklmno');
    const out = redactNativeJsonl(line);
    expect(JSON.parse(out)).toContain('[REDACTED:bearer]');
  });

  it('redacts private RSA/OpenSSH PEM blocks anywhere in the tree', () => {
    const pem =
      '-----BEGIN OPENSSH PRIVATE KEY-----\nMIIBVQIBADANBgkq\n-----END OPENSSH PRIVATE KEY-----';
    const line = JSON.stringify({
      type: 'tool_result',
      content: { result: { stderr: pem } },
    });
    const out = redactNativeJsonl(line);
    const parsed = JSON.parse(out);
    expect(parsed.content.result.stderr).toBe('[REDACTED:private_key]');
  });

  it('redacts OAuth Authorization Bearer tokens nested in message content', () => {
    const line = JSON.stringify({
      type: 'user',
      message: { content: 'curl -H "Authorization: Bearer abc.def-ghi_jklmno"' },
    });
    const out = redactNativeJsonl(line);
    const parsed = JSON.parse(out);
    expect(parsed.message.content).toContain('[REDACTED:bearer]');
  });

  it('redacts arrays of strings recursively', () => {
    const line = JSON.stringify([
      'normal',
      'sk-ant-api03-AAAAAAAAAAAAAAAAAAAA',
      { nested: 'AIzaSyA-AAAAAAAAAAAAAAAAAAA' },
    ]);
    const out = redactNativeJsonl(line);
    const parsed = JSON.parse(out);
    expect(parsed[0]).toBe('normal');
    expect(parsed[1]).toContain('[REDACTED:anthropic_key]');
    expect(parsed[2].nested).toContain('[REDACTED:google_key]');
  });

  // FR-002 acceptance: native Claude Code fields must survive redaction so
  // downstream consumers can still rely on them. Spec §63 mandates this.
  it('preserves native Claude Code session fields through redaction', () => {
    const line = JSON.stringify({
      type: 'assistant',
      uuid: 'aaaa-bbbb-cccc-dddd',
      parentUuid: 'eeee-ffff-0000-1111',
      sessionId: 'session-12345',
      isSidechain: false,
      cwd: '/workspace/repo',
      gitBranch: 'main',
      version: '1.0.42',
      usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 10 },
      message: { content: 'token=ghp_1234567890abcdefghij' },
    });
    const out = redactNativeJsonl(line);
    const parsed = JSON.parse(out);
    expect(parsed.uuid).toBe('aaaa-bbbb-cccc-dddd');
    expect(parsed.parentUuid).toBe('eeee-ffff-0000-1111');
    expect(parsed.sessionId).toBe('session-12345');
    expect(parsed.isSidechain).toBe(false);
    expect(parsed.cwd).toBe('/workspace/repo');
    expect(parsed.gitBranch).toBe('main');
    expect(parsed.version).toBe('1.0.42');
    expect(parsed.usage).toEqual({
      input_tokens: 100,
      output_tokens: 50,
      cache_read_input_tokens: 10,
    });
    expect(parsed.message.content).toContain('[REDACTED:github_token]');
  });
});
