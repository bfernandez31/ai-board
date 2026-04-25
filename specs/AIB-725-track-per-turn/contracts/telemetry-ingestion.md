# Contract: Telemetry Ingestion — Per-Turn Tracking (Internal)

**Endpoint**: `POST /api/telemetry/v1/logs` (workflow-authenticated)
**Source**: `app/api/telemetry/v1/logs/route.ts` → `lib/telemetry/otlp-processor.ts::processTelemetry`

This is an **internal** contract: only the workflow runners call this endpoint, and the request shape is unchanged (OTLP logs envelope or Mistral batch payload). This contract documents the **new side-effect** — the three Job columns this endpoint now populates — and the **new merge semantics**.

## Inputs (unchanged)

- **OTLP logs envelope** (Claude/Codex/Gemini): `resourceLogs[].resource.attributes[job_id]` + `scopeLogs[].logRecords[]` with per-event attributes already parsed today.
- **Batch payload** (Mistral): `{ jobId, agent, inputTokens, outputTokens, ..., costStatus, usageSnapshotMode }` per `batchPayloadSchema` at `lib/telemetry/otlp-processor.ts:17–31` — unchanged, no new fields.

## Outputs (unchanged response + new persisted side-effects)

Response body is **unchanged**: `{ status: 'accepted', jobId, metrics: {...} }` or the relevant error shape.

**New persisted side-effects on the `Job` row**:

| Agent | OTLP event driving the turn | `peakContextTokens` | `avgContextTokens` | `turnCount` |
|-------|-----------------------------|---------------------|--------------------|-------------|
| Claude | `claude_code.api_request` (each event = one turn) | `max(prev, max(input+cacheRead+cacheCreation per event))` | `round(totalSum / totalTurnCount)` | `prev + deltaBatch.turns` |
| Codex | `codex.sse_event` with `event.kind='response.completed'` | `max(prev, max(input_token_count per event))` | `round(totalSum / totalTurnCount)` | `prev + deltaBatch.turns` |
| Gemini | any `gemini_cli.*` event (cumulative snapshot) | `max(prev, snapshot.input + cacheRead + cacheCreation)` | **`null`** (no per-turn data) | **`null`** |
| Mistral (batch) | n/a | **`null`** | **`null`** | **`null`** |

**Null rules** (FR-004):
- Writes a `null` **never** replaces a non-null prior value.
- If a batch produces no parseable per-turn events (e.g., only tool_result events), the three fields on the Job stay at their prior values (unchanged — not reset to null).
- The three fields remain in their initial `null` state until the first batch with parseable per-turn data writes them (Claude/Codex), or the first cumulative snapshot writes `peakContextTokens` alone (Gemini).

## Atomicity

All three new fields + all existing telemetry fields are written in a **single** `prisma.job.update` call inside `updateJobMetrics` (`otlp-processor.ts:253`). No separate UPDATE; no split transaction.

**Ordering across concurrent batches**: OTLP batches for the same job are expected to arrive serially from the runner (each runner emits one OTLP exporter). If two batches arrive concurrently (rare), the Prisma update is read-modify-write and the later-committing UPDATE wins; both batches' peak/sum are computed relative to the same snapshot the processor read at the start of that request, so the final peak may undercount by at most one batch's peak. This matches the existing processor's behavior for `inputTokens`/`costUsd` — no regression, no new concurrency bug (FR-013).

## Error behavior (per existing processor conventions)

- **Malformed per-turn attributes** (non-numeric `input_tokens`, etc.): `parseIntAttribute` returns 0; that turn contributes 0 to peak/sum but still increments `turnCount`. Matches the spec edge case "A parsing error on a single event does not fail the job".
- **Job not found**: 404 response as today (`otlp-processor.ts:200–203`). No side effect.
- **No per-turn events in a batch** (e.g., only tool events): the processor writes only the tool/non-context telemetry. The three new fields are not included in the `UPDATE`'s `SET` list — they retain whatever value they had before.
- **Zero-event batch**: returns 200 with `{status: 'accepted', message: 'Telemetry received but no supported provider events were found'}` — unchanged (`otlp-processor.ts:300–308`). No Job write.

## Security (unchanged)

- Workflow bearer token verification at the route handler (`validateWorkflowAuth`) — unchanged.
- Secrets (`WORKFLOW_API_TOKEN`) are already env-var only; no new secrets introduced.
- No user-submitted content is stored in the three new fields — they are numeric aggregates computed from already-validated OTLP attribute values.
