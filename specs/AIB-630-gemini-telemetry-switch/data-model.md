# Data Model: Gemini Telemetry via Native Provider Events

## Entities

### 1. Workflow Job

Existing persistence entity in `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma`.

| Field | Type | Source after this change | Notes |
|-------|------|--------------------------|-------|
| `id` | `Int` | Existing DB row | Correlated from OTLP `job_id` resource attribute |
| `status` | `JobStatus` | `/api/jobs/[id]/status` | Remains authoritative for success, failure, and cancellation |
| `model` | `String?` | Gemini native OTLP event attributes | Exact Gemini model identifier when emitted |
| `inputTokens` | `Int?` | Gemini native OTLP | Non-cached input tokens |
| `outputTokens` | `Int?` | Gemini native OTLP | Output tokens |
| `thinkingTokens` | `Int?` | Gemini native OTLP | Preserved distinctly when emitted |
| `cacheReadTokens` | `Int?` | Gemini native OTLP | Cached prompt tokens or equivalent native field |
| `cacheCreationTokens` | `Int?` | Gemini native OTLP | Cache-write / cache-creation tokens when emitted |
| `durationMs` | `Int?` | Gemini native OTLP or status fallback | Native duration wins; wall-clock fallback remains available |
| `costUsd` | `Float?` | Gemini native OTLP or route-side estimation | Null when unavailable; never synthesized from reconstructed stdout |
| `toolsUsed` | `String[]` | Gemini native OTLP tool events | Set-merged unique tool names |

### 2. Gemini Native Telemetry Event

Ephemeral OTLP log record parsed by `/api/telemetry/v1/logs`.

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `resource.attributes.job_id` | `string \| number` | Yes | Correlates the event to an existing `Job` |
| `event.name` or `body.stringValue` | `string` | Yes | Identifies Gemini-native event family, expected `gemini_cli.*` |
| token attributes | provider-native numbers/strings | No | Populate input, output, thinking, and cache fields when present |
| `model` | `string` | No | Captures exact Gemini model identifier |
| duration attribute | provider-native number/string | No | Populates `durationMs` |
| tool attribute | `string` | No | Adds a tool name into `toolsUsed` |
| cost attribute | provider-native number/string | No | Used directly when Gemini emits native cost; otherwise route may estimate |

Validation rules:
- Must pass the shared OTLP schema in `/home/runner/work/ai-board/ai-board/target/lib/schemas/otlp.ts`.
- Must include a parseable `job_id` to persist metrics.
- Unsupported or malformed Gemini events are ignored or logged without mutating another job.

### 3. Mistral Batch Telemetry Payload

Existing provider-specific batch contract that remains supported after this ticket.

| Field | Type | Notes |
|-------|------|-------|
| `jobId` | `number` | Required to persist telemetry |
| `agent` | `'MISTRAL'` | Gemini is removed from the supported batch path |
| token/model/tool fields | existing batch payload | Remains unchanged |

### 4. Ticket Telemetry Views

Derived read models backed by persisted `Job` telemetry.

| Consumer | Dependency | Behavior after change |
|----------|------------|-----------------------|
| Ticket jobs API | normalized `Job` fields | No contract change; Gemini data source changes only |
| Ticket timeline/detail UI | normalized `Job` fields | Failed Gemini jobs remain failed even when telemetry is sparse |
| Analytics queries | normalized `Job` fields | Existing aggregations continue working because storage shape is unchanged |

## Relationships

- `Project 1 -> many Ticket`
- `Ticket 1 -> many Job`
- `Gemini Native Telemetry Event many -> 1 Job` by `job_id`
- `Mistral Batch Telemetry Payload many -> 1 Job` by `jobId`

## State Transitions

### Job outcome lifecycle

1. Workflow moves job to `RUNNING` through `/api/jobs/[id]/status`.
2. Native Gemini OTLP events may arrive during execution and update telemetry fields.
3. Workflow posts terminal status through `/api/jobs/[id]/status` as `COMPLETED`, `FAILED`, or `CANCELLED`.
4. If no native duration was stored, the status route backfills `durationMs` from wall clock.

Invariant:
- Telemetry never upgrades a failed Gemini job to success.

### Provider routing lifecycle

1. Telemetry route receives request.
2. If request is OTLP `resourceLogs`, it evaluates event identity:
   - `claude_code.*` -> Claude parser
   - `codex.*` -> Codex parser
   - `gemini_cli.*` -> new Gemini native parser
3. If request is non-OTLP batch JSON, it is processed only as the Mistral batch path.

Invariant:
- Gemini has no supported batch fallback after this ticket.

## Derived Data Rules

- `toolsUsed` is always deduplicated and sorted before persistence.
- Missing optional Gemini metrics remain null/empty rather than being replaced with fabricated values.
- `costUsd` remains null when Gemini omits cost and the route cannot safely estimate it.
- Analytics and ticket views consume the same persisted `Job` values regardless of provider.
