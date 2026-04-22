# Normalized Event Stream — v1 Contract

The stored transcript artifact is **gzipped JSONL** at
`logs/<projectId>/<ticketId>/<jobId>.jsonl.gz`. Every line is a single UTF-8
JSON object. The **first line** is a header; every following line is a
`NormalizedEvent`.

## Header line (line 0)

```json
{
  "schemaVersion": 1,
  "agent": "CLAUDE",
  "jobId": 4321,
  "startedAt": "2026-04-22T10:00:00.000Z",
  "endedAt": "2026-04-22T10:02:15.120Z"
}
```

- `schemaVersion` is **mandatory** on every artifact. Unknown versions MUST be
  rejected by the viewer with a readable error — never best-effort parsed.
- `agent` ∈ `CLAUDE | CODEX | MISTRAL | GEMINI`.
- `endedAt` is `null` when the job was cancelled before the agent terminated
  cleanly; the runner still produces the artifact in that case.

## Event lines (lines 1..N)

All events share:

```ts
interface BaseEvent<T extends EventType, P> {
  ts: string;              // ISO 8601 UTC
  type: T;
  agent: 'CLAUDE' | 'CODEX' | 'MISTRAL' | 'GEMINI';
  payload: P;
}
```

### `message`

```ts
{
  ts, type: 'message', agent,
  payload: {
    role: 'agent' | 'user' | 'system';
    text: string;           // redacted
    thinking?: string;      // only for agents that expose extended thinking; redacted
  }
}
```

### `tool_invocation`

```ts
{
  ts, type: 'tool_invocation', agent,
  payload: {
    toolName: string;       // e.g. "Bash", "Read", "Edit"
    toolCallId: string;     // agent-native id, stringified
    input: unknown;         // JSON-serializable, recursively redacted
  }
}
```

### `tool_result`

```ts
{
  ts, type: 'tool_result', agent,
  payload: {
    toolCallId: string;     // correlates back to tool_invocation
    output: unknown;        // recursively redacted
    isError: boolean;
  }
}
```

### `error`

```ts
{
  ts, type: 'error', agent,
  payload: {
    message: string;        // redacted
    stack?: string;         // redacted
  }
}
```

### `lifecycle`

```ts
{
  ts, type: 'lifecycle', agent,
  payload: {
    kind: 'started' | 'completed' | 'cancelled' | 'timeout' | 'upstream_error';
    detail?: string;        // short human-readable reason; redacted
  }
}
```

## Ordering & completeness

- Events MUST be written in monotonically non-decreasing `ts` order. Ties are
  allowed; strict ordering is not required beyond that.
- At minimum, every artifact MUST contain one `lifecycle:started` event and one
  of `lifecycle:completed` / `lifecycle:cancelled` / `lifecycle:upstream_error`.
  A job cancelled before any agent output still produces this minimal pair
  (edge case in spec §Edge Cases).

## Redaction contract

All string fields inside any `payload` are passed through the redactor before
serialization. Redacted substrings are replaced with a literal placeholder in
the form `[REDACTED:<kind>]`, for example:

- `[REDACTED:github_token]`
- `[REDACTED:bearer]`
- `[REDACTED:private_key]`
- `[REDACTED:env_secret:<KEY_NAME>]`

Empty-string elision is forbidden.

## Size limits

| Scope                   | Limit              | Overflow behavior                                                                                          |
|-------------------------|--------------------|------------------------------------------------------------------------------------------------------------|
| Artifact total (gzipped)| 25 MB              | Truncate; append `lifecycle: { kind: 'upstream_error', detail: 'transcript_truncated' }` as final event.   |
| Single event payload    | 1 MB raw JSON      | Replace payload string values that would cause overflow with `[TRUNCATED]` and set `isError: true` on tool_result. |

## Forward compatibility

- Viewers MUST ignore unknown keys on known event types.
- Unknown `type` values MUST NOT throw; they render as a neutral "unknown
  event" row so a future v2 reader is tolerant of v1 data.
