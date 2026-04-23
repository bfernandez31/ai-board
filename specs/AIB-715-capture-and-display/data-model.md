# Data Model — AIB-715 Capture and display agent execution logs

## 1. New Entities

### 1.1 `JobLog` (Postgres, via Prisma)

```prisma
model JobLog {
  id             Int           @id @default(autoincrement())
  jobId          Int           @unique
  job            Job           @relation(fields: [jobId], references: [id], onDelete: Cascade)

  captureStatus  CaptureStatus
  preview        String        @db.VarChar(320) // hard cap 280 chars + slack for unicode
  schemaVersion  Int           @default(1)
  eventCount     Int           @default(0)
  errorCount     Int           @default(0)

  // External artifact reference. Null when captureStatus != CAPTURED.
  artifactKey    String?       @db.VarChar(300) // e.g. "logs/<projectId>/<ticketId>/<jobId>.jsonl.gz"
  artifactSize   Int?                           // bytes; null when unavailable/pruned

  capturedAt     DateTime      @default(now())
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  @@index([captureStatus, createdAt]) // retention prune scan
  @@index([createdAt])                 // retention prune ordering
}
```

- `onDelete: Cascade` guarantees that deleting a Job also purges its Log Record (matches ticket cascade semantics already used across the schema).
- No soft-delete column: per FR-020 pruning is hard-delete only.
- Retention prune fetches by `createdAt < cutoff AND captureStatus != 'PRUNED'`; the combined index services that scan.

### 1.2 `CaptureStatus` enum

```prisma
enum CaptureStatus {
  CAPTURED     // Transcript artifact uploaded and referenced by artifactKey
  UNAVAILABLE  // Capture, redaction, or upload failed after bounded retry
  PRUNED       // Retention pruning removed the artifact; preview retained until row pruned next cycle
}
```

Rationale: three-state enum is sufficient for the UI to render three distinct visual states and for the prune pipeline to identify "already pruned" rows during an idempotent re-run.

### 1.3 `Job` relation addition

Add to the existing `Job` model (no new fields on Job itself):

```prisma
model Job {
  // …existing fields unchanged…
  log JobLog?
}
```

**Non-change**: `Job.logs String?` is **left in place** — it is still referenced by the full-clone code path at `lib/db/tickets.ts:717`, and the new feature does not rely on it.

## 2. Normalized Transcript Artifact (external, not in Postgres)

Stored in Vercel Blob at key `logs/<projectId>/<ticketId>/<jobId>.jsonl.gz`. Format: **gzipped JSONL** (one JSON object per line). Each line conforms to the v1 normalized event schema:

```ts
type NormalizedEvent =
  | { ts: string; type: 'message';          agent: AgentId; payload: { role: 'agent' | 'user' | 'system'; text: string; thinking?: string } }
  | { ts: string; type: 'tool_invocation';  agent: AgentId; payload: { toolName: string; toolCallId: string; input: unknown } }
  | { ts: string; type: 'tool_result';      agent: AgentId; payload: { toolCallId: string; output: unknown; isError: boolean } }
  | { ts: string; type: 'error';            agent: AgentId; payload: { message: string; stack?: string } }
  | { ts: string; type: 'lifecycle';        agent: AgentId; payload: { kind: 'started' | 'completed' | 'cancelled' | 'timeout' | 'upstream_error'; detail?: string } };

type AgentId = 'CLAUDE' | 'CODEX' | 'MISTRAL' | 'GEMINI';
```

The artifact file always begins with a **header line** carrying `{ "schemaVersion": 1, "agent": AgentId, "jobId": number, "startedAt": ISO8601, "endedAt": ISO8601 | null }` — this lets the viewer discriminate schemas before parsing the stream.

## 3. Lifecycle and State Transitions

### 3.1 JobLog states

```
(none) ───▶ CAPTURED ───▶ (hard-deleted by retention prune)
     │
     └────▶ UNAVAILABLE ──▶ (hard-deleted by retention prune)

CAPTURED ─ (retention: row kept, artifact deleted) ──▶ PRUNED ──▶ (hard-deleted by retention prune)
```

Notes:
- Transition **(none) → CAPTURED** happens via `POST /api/jobs/:id/logs` with `captureStatus=CAPTURED` after a successful artifact upload.
- Transition **(none) → UNAVAILABLE** happens via the same endpoint with `captureStatus=UNAVAILABLE` when the runner could not complete capture (bounded retry exhausted).
- Transition **CAPTURED → PRUNED** is used by a **first-pass** of the retention job when Blob delete succeeds but we decide to keep the Postgres row for one more cycle so the UI can display "logs no longer retained." v1 uses the simpler **single-pass hard-delete** for both — the `PRUNED` state exists in the enum but is only written if a two-pass strategy is later required. **Keep the enum value now** to avoid a later migration.
- `POST /api/jobs/:id/logs` is an upsert: a second call for the same `jobId` replaces the existing row (e.g., a workflow retry that re-runs the same job is impossible under current semantics — job IDs are append-only per spec edge case — but the upsert protects against bounded-retry loops).

### 3.2 Job relation

- When a Job reaches a terminal state, the capture workflow step attempts to create/update its `JobLog`. Job's terminal status update is **independent** and is dispatched by a separate `PATCH /api/jobs/:id/status` call that MUST run regardless of log capture outcome (FR-016).

## 4. Validation Rules

### 4.1 Write-side (API)

`POST /api/jobs/:id/logs` body, validated with Zod (`app/lib/logs/schema.ts`):

| Field | Rule |
|---|---|
| `captureStatus` | enum `CAPTURED` \| `UNAVAILABLE` |
| `preview` | string, 1..280 chars; stripped of control chars; re-run through `redactor` server-side as defense-in-depth |
| `schemaVersion` | integer, currently `1`; accepted-values list enforced |
| `eventCount` | integer ≥ 0 |
| `errorCount` | integer ≥ 0, ≤ `eventCount` |
| `artifactKey` | string; required when `captureStatus === CAPTURED`; forbidden otherwise |
| `artifactSize` | integer > 0; required when `captureStatus === CAPTURED`; forbidden otherwise |

`PUT /api/jobs/:id/logs/artifact` body: raw `application/gzip` stream, max 25 MB (see §5). `Content-Type` MUST be `application/gzip`; any other value → 415.

### 4.2 Read-side (API)

- `GET .../logs` returns `{ captureStatus, preview, schemaVersion, eventCount, errorCount, artifactSize, capturedAt, rawUrl: string | null }`. `rawUrl` is null unless `captureStatus === CAPTURED`.
- `GET .../logs/raw` streams the artifact from Blob; gzip Content-Encoding preserved; supports `?format=jsonl` which sets `Content-Disposition: attachment; filename="<ticket>-<jobId>.jsonl.gz"` for the download button.

### 4.3 Redaction invariant

Every string field in every event payload MUST be passed through the redactor before persistence. This includes:
- `message.payload.text`, `message.payload.thinking`
- `tool_invocation.payload.input` (deeply stringify and redact; values re-parsed after redaction via a safe visitor — see `app/lib/logs/redactor.ts`)
- `tool_result.payload.output` (same deep-visitor)
- `error.payload.message`, `error.payload.stack`
- `preview` (the derived preview is also re-redacted server-side)

## 5. Size Budgets

| Surface | Limit | Behavior on overflow |
|---|---|---|
| `preview` (Postgres) | 280 chars effective, 320 DB cap | Truncate with `…` at 280; surfaces UNAVAILABLE capture handled as literal string inside the same cap. |
| Artifact upload per job | 25 MB gzipped | Runner truncates the raw log at a budget slightly below the limit, records a final `lifecycle` event with `{ kind: 'upstream_error', detail: 'transcript_truncated' }`, and uploads what fits. The UI viewer shows a clearly-marked truncation notice derived from that lifecycle entry. |
| Single event payload | 1 MB gzipped | Same truncation treatment on a per-event basis. |

## 6. Access Rules

| Endpoint | Auth | Authorized subject |
|---|---|---|
| `POST /api/jobs/:id/logs` | `validateWorkflowAuth` | GitHub Actions workflow runner |
| `PUT /api/jobs/:id/logs/artifact` | `validateWorkflowAuth` | GitHub Actions workflow runner |
| `GET .../jobs/:jobId/logs` | Session + `verifyTicketAccess` | Project owner OR project member |
| `GET .../jobs/:jobId/logs/raw` | Session + `verifyTicketAccess` | Project owner OR project member |
| `POST /api/maintenance/prune-logs` | `verifyWorkflowToken` | Scheduled GitHub Actions runner |

No log record is world-readable. The Blob pathname is never rendered client-side.

## 7. Retention

- Records with `createdAt < now() - 30d` are pruned by `POST /api/maintenance/prune-logs`.
- Prune sequence **per record**:
  1. If `artifactKey` is set: call `del(artifactKey)` on Vercel Blob. Treat `404 / already-absent` as success.
  2. If step 1 succeeded: `delete JobLog where id = ?`.
  3. If step 1 failed with a non-retriable error: log, skip (`JobLog` row remains, retried next cycle).
- Pruning is idempotent: a re-run over the same window finds no matching rows once the last cycle completed.

## 8. Relation to Existing Telemetry

`JobLog` is strictly additive. Existing telemetry fields on `Job` (`inputTokens`, `costUsd`, `toolsUsed`, `qualityScore`, etc.) continue to be written by the existing `PATCH /api/jobs/:id/status` and OTLP `POST /api/telemetry/v1/logs` paths, both of which are **unchanged** by this feature. This preserves FR-018 (no telemetry regression) and SC-007.
