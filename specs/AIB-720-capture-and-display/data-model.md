# Data Model: Capture and display agent execution logs

## Overview

The feature adds a dedicated log artifact relation for each terminal `Job`. The existing `Job` row remains the source of truth for workflow state and telemetry; the new relation stores normalized execution detail, summary preview metadata, and retention state.

## Entities

### Job (existing, extended relation only)

`Job` remains authoritative for:

- workflow identity: `id`, `ticketId`, `projectId`, `command`, `workflowRunId`
- terminal state: `status`, `startedAt`, `completedAt`
- telemetry: token counts, cost, duration, model, tools used, quality score

Planned relation changes:

| Field | Type | Purpose |
|-------|------|---------|
| `executionLog` | `JobExecutionLog?` | Optional one-to-one relation for post-completion log artifact |

Planned query-facing additions returned through read DTOs, not necessarily persisted on `Job`:

| DTO field | Type | Purpose |
|-----------|------|---------|
| `logAvailability` | `AVAILABLE \| PARTIAL \| UNAVAILABLE \| PRUNED` | User-facing state for preview/detail access |
| `logSummary` | `JobLogSummary \| null` | Condensed preview data |
| `logCapturedAt` | `string \| null` | Detail capture timestamp |
| `logRetainedUntil` | `string \| null` | Guaranteed retention deadline |
| `logPrunedAt` | `string \| null` | When detailed payload bytes were removed |

### JobExecutionLog (new persisted entity)

One row per job, created only after a supported agent-driven job reaches a terminal state or a capture failure is recorded.

| Field | Type | Validation / Notes |
|-------|------|--------------------|
| `id` | `Int` | Primary key |
| `jobId` | `Int @unique` | Required one-to-one relation to `Job` |
| `projectId` | `Int` | Denormalized for project-scoped lookup/indexing |
| `ticketId` | `Int` | Denormalized for ticket-scoped joins/indexing |
| `agent` | `Agent` | Existing enum: `CLAUDE`, `CODEX`, `MISTRAL`, `GEMINI` |
| `availability` | `JobLogAvailability` | Required enum; see state transitions below |
| `sourceFormat` | `String` | Provider/source bundle type, e.g. `claude-otlp`, `codex-otlp`, `mistral-session`, `gemini-otlp` |
| `summaryJson` | `Json` | Required normalized `JobLogSummary`; present even when detail is partial/pruned |
| `eventCount` | `Int` | Non-negative number of normalized events retained in the artifact at capture time |
| `artifactEncoding` | `String?` | `gzip-json`, nullable when no detail payload exists |
| `artifactBytes` | `Bytes?` | Compressed normalized event array; nullable for unavailable/pruned records |
| `artifactSha256` | `String?` | Optional checksum for idempotence and integrity |
| `artifactSizeBytes` | `Int?` | Compressed payload size; nullable for unavailable/pruned records |
| `partialReason` | `String?` | Human-readable explanation when `availability = PARTIAL` |
| `unavailableReason` | `String?` | Human-readable explanation when `availability = UNAVAILABLE` |
| `capturedAt` | `DateTime` | When upload finalized |
| `retainedUntil` | `DateTime` | At least 30 days after capture or job completion |
| `prunedAt` | `DateTime?` | Set when `artifactBytes` is removed |
| `createdAt` | `DateTime` | Standard audit field |
| `updatedAt` | `DateTime` | Standard audit field |

Indexes:

- `@@index([projectId, capturedAt])`
- `@@index([ticketId, capturedAt])`
- `@@index([availability, retainedUntil])`
- `@@index([prunedAt])`

### JobLogSummary (stored inside `summaryJson`)

Small, query-friendly preview object returned by ticket jobs/timeline APIs.

| Field | Type | Notes |
|-------|------|-------|
| `headline` | `string` | Primary human-readable outcome line |
| `status` | `COMPLETED \| FAILED \| CANCELLED` | Mirrors terminal job status for the preview |
| `latestImportantEvents` | `JobLogSummaryEvent[]` | Small bounded list, e.g. last 3-5 meaningful events |
| `errorReason` | `string \| null` | Final failure/cancel reason if available |
| `partial` | `boolean` | Whether the detail bundle is incomplete |
| `unavailable` | `boolean` | Whether no detail bundle exists |
| `pruned` | `boolean` | Whether detail used to exist but was removed |
| `capturedEventCount` | `number` | Count at capture time |

### JobLogSummaryEvent (stored inside `summaryJson`)

| Field | Type | Notes |
|-------|------|-------|
| `timestamp` | ISO 8601 string | Event time |
| `kind` | `MESSAGE \| TOOL \| WARNING \| ERROR \| STATUS` | Preview classification |
| `label` | `string` | Short readable sentence |

### JobLogEvent (stored inside compressed artifact payload)

Normalized detail record preserved in execution order.

| Field | Type | Notes |
|-------|------|-------|
| `sequence` | `number` | Monotonic within the job |
| `timestamp` | ISO 8601 string | Event time |
| `kind` | `MESSAGE \| TOOL_CALL \| TOOL_RESULT \| WARNING \| ERROR \| STATUS` | Cross-agent normalized category |
| `actor` | `agent \| tool \| system` | Source of the event |
| `title` | `string` | Short display heading |
| `body` | `string \| null` | Human-readable detail text |
| `toolName` | `string \| null` | Present for tool events |
| `metadata` | `Record<string, unknown> \| null` | Provider-specific detail preserved for debugging |

## Relationships

```text
Project (1) ------ (*) Job ------ (0..1) JobExecutionLog
Ticket  (1) ------ (*) Job ------ (0..1) JobExecutionLog
```

- Every `JobExecutionLog` belongs to exactly one `Job`.
- `projectId` and `ticketId` are duplicated on `JobExecutionLog` to avoid a heavy join when reading timeline/job summaries.
- The log row is optional because active jobs have no terminal artifact yet and capture can fail.

## Validation Rules

1. `jobId` must reference an existing `Job`.
2. Upload is accepted only for terminal jobs or when explicitly marking the artifact unavailable for a terminal job.
3. `availability = AVAILABLE` requires:
   - `summaryJson`
   - `capturedAt`
   - `retainedUntil`
   - `artifactBytes`
   - `eventCount >= 1`
4. `availability = PARTIAL` requires:
   - `summaryJson`
   - `capturedAt`
   - `retainedUntil`
   - `partialReason`
   - `artifactBytes` may be present or absent depending on how much detail survived
5. `availability = UNAVAILABLE` requires:
   - `summaryJson`
   - `capturedAt`
   - `retainedUntil`
   - `unavailableReason`
   - `artifactBytes = null`
6. `availability = PRUNED` requires:
   - `summaryJson`
   - `capturedAt`
   - `retainedUntil`
   - `prunedAt`
   - `artifactBytes = null`
7. Stored detail payloads must be sanitized to exclude secrets, auth headers, and credential file contents.

## State Transitions

### Job lifecycle vs log lifecycle

`Job.status` remains:

```text
PENDING -> RUNNING -> COMPLETED
                  -> FAILED
                  -> CANCELLED
```

`JobExecutionLog.availability` begins only after terminal job state:

```text
no row
  -> AVAILABLE
  -> PARTIAL
  -> UNAVAILABLE

AVAILABLE -> PRUNED
PARTIAL   -> PRUNED
UNAVAILABLE -> UNAVAILABLE   (no further detail to prune)
PRUNED -> PRUNED             (terminal)
```

Rules:

1. No execution log row is required while a job is `PENDING` or `RUNNING`.
2. Terminal job + successful upload -> `AVAILABLE` or `PARTIAL`.
3. Terminal job + upload/capture failure -> `UNAVAILABLE`.
4. Retention cleanup converts `AVAILABLE` or `PARTIAL` to `PRUNED` by removing `artifactBytes` but retaining `summaryJson`.

## API Read Models

### Ticket job row DTO

Returned by `GET /api/projects/:projectId/tickets/:ticketId/jobs`.

```ts
interface TicketJobWithLogs extends TicketJobWithTelemetry {
  logAvailability: 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE' | 'PRUNED' | null;
  logCapturedAt: string | null;
  logRetainedUntil: string | null;
  logPrunedAt: string | null;
  logSummary: JobLogSummary | null;
}
```

### Full log detail DTO

Returned by `GET /api/projects/:projectId/jobs/:jobId/logs`.

```ts
interface JobExecutionLogDetail {
  jobId: number;
  ticketId: number;
  projectId: number;
  agent: 'CLAUDE' | 'CODEX' | 'MISTRAL' | 'GEMINI';
  availability: 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE' | 'PRUNED';
  capturedAt: string | null;
  retainedUntil: string | null;
  prunedAt: string | null;
  partialReason: string | null;
  unavailableReason: string | null;
  summary: JobLogSummary;
  events: JobLogEvent[] | null;
}
```

## Retention Rules

1. `retainedUntil` is set to at least 30 days after the later of `completedAt` or `capturedAt`.
2. Pruning removes only `artifactBytes` and payload-size metadata, not the summary or audit state.
3. Read APIs continue returning the summary after pruning and clearly label the detail as unavailable because it was pruned.

## Non-Goals

1. No real-time streaming of partially running logs.
2. No provider-auth secret persistence inside log artifacts.
3. No duplication of retained detailed logs during ticket clone/copy flows.

