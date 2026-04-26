# Research: Track Per-Turn Context Size on Jobs (AIB-725)

**Branch**: `AIB-725-track-per-turn` | **Spec**: `specs/AIB-725-track-per-turn/spec.md`

## Existing Files

### Telemetry ingestion (extend — no new source of truth)

| Path | Covers | Action |
|------|--------|--------|
| `lib/telemetry/otlp-processor.ts` | Main OTLP ingestion + Mistral batch payload + DELTA/CUMULATIVE merge + cost estimators (OpenAI/Mistral/Gemini). **The logRecord loop at lines 643–710 is where per-turn events are parsed today.** | **Extend** — add per-turn context-size tracking inside the existing loop and extend `TelemetryMetrics`, `updateJobMetrics`, and `batchPayloadSchema`. No new file. |
| `lib/schemas/otlp.ts` | Zod schemas for OTLP log records/attributes + `findAttribute`, `parseIntAttribute` helpers. | **Reuse as-is** — the helpers already cover every attribute we need to read. |
| `app/api/telemetry/v1/logs/route.ts` | Thin handler: auth → `processTelemetry(body, startTime)` → respond. | **Unchanged** — all logic is in the processor. |

### Job model & persistence

| Path | Covers | Action |
|------|--------|--------|
| `prisma/schema.prisma` (`Job` model, lines 29–70) | Existing nullable telemetry columns (`inputTokens`, `outputTokens`, `thinkingTokens`, `cacheReadTokens`, `cacheCreationTokens`, `costUsd`, `durationMs`, `model`). | **Extend** — add `peakContextTokens: Int?`, `avgContextTokens: Int?`, `turnCount: Int?`. Same nullability pattern. |
| `prisma/migrations/20260413103000_add_job_thinking_tokens/migration.sql` | Single-line pattern: `ALTER TABLE "Job" ADD COLUMN "thinkingTokens" INTEGER;` | **Pattern reference** — new migration follows the same pattern. |

### Job types & API shape

| Path | Covers | Action |
|------|--------|--------|
| `lib/types/job-types.ts` — `TicketJobWithTelemetry` (lines 55–73) | The type consumed by the timeline and ticket stats. | **Extend** — add the three new nullable fields. |
| `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts` (lines 129–156) | `GET` ticket jobs; Prisma `select` drives what the UI sees. | **Extend** — add the three new fields to the `select` clause. |
| `app/api/projects/[projectId]/jobs/status/route.ts` | Short-polling endpoint: returns only `{id, status, ticketId, command, updatedAt}`. Does **not** expose telemetry. | **Unchanged** — per FR-015, the detailed jobs endpoint is the one that exposes telemetry; the status poller intentionally stays lean. |
| `app/api/jobs/[id]/status/route.ts` | Workflow-authenticated status PATCH (RUNNING → COMPLETED/FAILED/CANCELLED). Writes `qualityScore`, backfills `durationMs` from wall clock when needed. Does **not** write the token telemetry (that is the telemetry processor's job). | **Unchanged** — the three new fields follow the same split: written by `otlp-processor.ts`, read by this and the jobs endpoint. |

### UI surfaces

| Path | Covers | Action |
|------|--------|--------|
| `components/ticket/jobs-timeline.tsx` | Ticket jobs timeline; `JobRow` renders duration pill (line 143–145), cost pill (line 147–150), model badge (line 134–138), and expandable token grid (lines 200–226). | **Extend** — add peak-context pill next to duration/cost (P1), and add average-context + turn-count rows inside the existing 2×2 grid → 3-column grid or new row (P3). |
| `components/analytics/analytics-dashboard.tsx` (lines 182–233) | Project analytics dashboard grid; slots new charts into the existing `<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">`. Polling interval = 15 s. | **Extend** — add a new `PeakContextDistributionChart` slot. |
| `components/analytics/token-usage-chart.tsx` | Pattern reference: Recharts `BarChart` inside shadcn `Card`, empty state when total == 0, `aurora-bg-subtle` class, `hsl(var(--chart-N))` fill colours, custom tooltip. | **Pattern reference** — new distribution chart copies this structure. |
| `lib/analytics/types.ts` (`TokenBreakdown`, `AnalyticsData`) | Response shape for `/api/projects/:projectId/analytics`. | **Extend** — add `peakContextDistribution: PeakContextBucket[]` on `AnalyticsData`. |
| `lib/analytics/queries.ts` (`getTokenUsage` lines 409–433) | Pattern reference: pure Prisma aggregation inside `buildJobWhere(projectId, filters, now, [JobStatus.COMPLETED])`. | **Extend** — add a sibling `getPeakContextDistribution` query. |
| `lib/analytics/aggregations.ts` | Pure helpers for formatting numbers (`formatAbbreviatedNumber`), bucketing, stage mapping. | **Extend** — add threshold/bucket helpers if they're pure, otherwise a new small module. |
| `lib/quality-score.ts` (`getScoreColor` lines 95–106) | Pattern reference: threshold → `{text, bg, fill}` object using `ctp-*` tokens. Static class strings only — no dynamic construction (per CLAUDE.md Tailwind rule). | **Pattern reference** — new `getPeakContextColor` function follows the same shape. |

### New files to create (after confirming no existing home)

| Path | Why | Why it can't go in an existing file |
|------|-----|--------------------------------------|
| `lib/telemetry/context-window.ts` | Centralized `MODEL_CONTEXT_WINDOWS` map + `getContextWindow(model)` + `getPeakContextThresholdState(peak, model)` + `getPeakContextColor(state)`. | The existing `lib/models/claude-models.ts` is Claude-specific and used by the model-selection UI; Codex/Gemini/Mistral models must also resolve a context window. A dedicated module keeps model-family details out of claude-models.ts. |
| `components/analytics/peak-context-distribution-chart.tsx` | New Recharts histogram for the analytics dashboard. | Each chart already lives in its own file (see `token-usage-chart.tsx`, `workflow-distribution-chart.tsx`). Matches the convention. |
| `prisma/migrations/<timestamp>_add_job_context_metrics/migration.sql` | Adds three INTEGER NULL columns. | Standard Prisma migration per-feature convention. |

### Existing tests (extend first — constitution §III)

| Path | Current coverage | Action |
|------|------------------|--------|
| `tests/integration/telemetry/agent-agnostic.test.ts` | US1–US4 across Claude/Codex/Gemini/Mistral OTLP + batch ingestion, with `buildOtlpPayload`/`buildGeminiNativePayload` helpers. | **Extend** — add per-turn tracking assertions (peak = max single-turn, avg = sum/turnCount, turnCount = event count, null for Mistral). |
| `tests/unit/telemetry/otlp-schema.test.ts` | OTLP schema validation unit tests. | **No change** — schema isn't changing. |
| `tests/unit/telemetry/aggregation.test.ts` | `aggregateJobTelemetry()` multi-job summation. | **Extend** only if that helper gains peak/avg/turn behavior (unlikely; these are per-job metrics, not cross-job aggregates). Likely **no change**. |
| `tests/integration/analytics/analytics-route.test.ts` | Analytics endpoint end-to-end. | **Extend** — assert `peakContextDistribution` is present in response, buckets reflect job seeds, filters propagate. |
| `tests/unit/components/analytics-dashboard.test.tsx` | Dashboard rendering + subscription-gated charts. | **Extend** — assert the new chart renders when data present and empty state when not. |
| `tests/integration/tickets/timeline.test.ts` | Ticket timeline endpoint. | **Extend** only if the timeline endpoint's payload needs new fields (it uses the jobs endpoint or a shared shape — verify during implementation). |
| `tests/e2e/tickets/` (various `.spec.ts`) | Playwright ticket flows. | **No new E2E** — constitution §III says default to integration tests. The peak-context pill behaviour is fully covered by the component test below. |

| New test file | Why a new file is warranted |
|---------------|------------------------------|
| `tests/unit/components/jobs-timeline.test.tsx` | There is **no existing** `jobs-timeline` component test (verified via `find`). Component test for the pill rendering rules, threshold variants, and "hide when null" rule would otherwise live in `ticket-stats.test.tsx` and mix concerns (that file tests stats aggregation, not timeline rendering). |
| `tests/unit/telemetry/context-window.test.ts` | Pure module — decision tree is small but contract-bearing (threshold boundaries, unknown model fallback). Unit tests match the constitution's decision tree item 1. |

## Patterns to Follow

### 1. Telemetry accumulation in `otlp-processor.ts`

Follow the existing **per-logRecord loop with DELTA accumulation** at `lib/telemetry/otlp-processor.ts:643–710`. Each Claude `claude_code.api_request` and each Codex `codex.sse_event` with `event.kind === 'response.completed'` already represents one turn. The new tracking hooks into that same loop:

```typescript
// Per-turn: compute this turn's context size
const turnContext = input + cacheRead + cacheCreation;   // Claude
const turnContext = totalInputTokens;                     // Codex (input_token_count is already total incl. cached)
deltaMetrics.peakContextTokens = Math.max(deltaMetrics.peakContextTokens ?? 0, turnContext);
deltaMetrics.contextSum = (deltaMetrics.contextSum ?? 0) + turnContext;
deltaMetrics.turnCount = (deltaMetrics.turnCount ?? 0) + 1;
```

**Why these formulas**:
- Claude's `input_tokens` is already non-cached only, so the attended window on that turn = input + cacheRead + cacheCreation (all three were loaded into context for that call). `output_tokens` is what the model produced, not what it attended, so it's excluded — this matches the "context size = what the model had to attend to" assumption A-002 in the spec.
- Codex's `input_token_count` already includes cached (per the comment at `otlp-processor.ts:673–678`), so that single value is the attended size on that turn.
- Gemini emits **cumulative snapshots**, not deltas (see `mergeGeminiTelemetryRecord`, lines 125–161, using `Math.max`). For Gemini we **cannot** count turns from the OTLP stream — one event batch usually carries one snapshot, and each subsequent snapshot supersedes the previous. Therefore Gemini jobs leave `turnCount` and `avgContextTokens` null (same treatment as Mistral, per FR-004); `peakContextTokens` can still be tracked as `max(snapshot.input + cacheRead + cacheCreation)` across cumulative snapshots.
- Mistral goes through `processBatchPayload` (lines 467–526) with a single pre-aggregated payload — no per-turn data exists, so all three fields stay null (FR-004).

### 2. Merge semantics across DELTA batches

Each OTLP POST is an **incremental batch** (`otlp-processor.ts:725–729`). The running peak must survive across batches, so the merge step must read the current DB values and merge against them. Follow the pattern at `lib/telemetry/otlp-processor.ts:178–289` (`updateJobMetrics`):

- Extend the `select` clause to include `peakContextTokens`, `avgContextTokens`, `turnCount`, and an internal running-sum column **or** recompute average from peak/turnCount if we store the sum implicitly (see data-model decision).
- Merge function: `peak = max(existingPeak, incomingPeak)`; `turnCount = existingTurnCount + incomingTurnCount`; `contextSum = existingSum + incomingSum`; `avg = contextSum / turnCount` (written only when `turnCount > 0`).
- For CUMULATIVE mode (Gemini), peak uses `Math.max` with the snapshot's peak; turnCount and avg stay null.

### 3. Error handling in the processor

Follow the **swallow-per-event, fail-loud-per-job** pattern already used throughout `otlp-processor.ts`:
- Missing/malformed attributes: `parseIntAttribute` returns 0 (lines 121–125), not throw. A single bad event doesn't fail the batch. Matches the spec's error behavior note.
- `prisma.job.findUnique` returning null → `{status: 404, body: {error: 'Job not found'}}` (line 200–203). Same contract for the new fields.
- Never return success with partial writes: the single `prisma.job.update` at line 253 writes all merged fields atomically. New fields go in the same `updateData` object — no separate UPDATE call.

This is the constitution §V "DB state must remain consistent" rule: one transaction, one truth.

### 4. Threshold & color helper (copy from `lib/quality-score.ts:95–106`)

```typescript
export function getPeakContextColor(state: 'healthy'|'warning'|'danger'): { text: string; bg: string } {
  if (state === 'danger')  return { text: 'text-ctp-red',    bg: 'bg-ctp-red/10' };
  if (state === 'warning') return { text: 'text-ctp-yellow', bg: 'bg-ctp-yellow/10' };
  return { text: 'text-ctp-overlay1', bg: 'bg-transparent' };  // neutral (no "healthy green" — avoid false reassurance before tuning)
}
```

**Static class strings only** — per CLAUDE.md rule: "NEVER construct Tailwind class names dynamically". The function returns complete literal strings for each branch.

### 5. Chart component (copy from `components/analytics/token-usage-chart.tsx`)

The new peak-context distribution chart is a Recharts `BarChart` of histogram buckets. Copy the `Card` + `CardHeader` + `CardContent` structure, `aurora-bg-subtle` class, `hsl(var(--chart-N))` colours, empty-state guard, and custom tooltip. The only differences: input shape is `Array<{bucket: string, count: number, fill: string}>` and the dashboard passes the filtered `peakContextDistribution`.

### 6. Analytics endpoint extension (`lib/analytics/queries.ts`)

Follow `getTokenUsage` (lines 409–433): one `prisma.job.findMany` or `groupBy` scoped with `buildJobWhere(projectId, filters, now, [JobStatus.COMPLETED])`, reducing to fixed-width buckets in memory. The filters for command type / workflow type / quality-score bucket must reuse `buildJobWhere` (command and quality already hang off `job.command` / `job.qualityScore`; workflow type hangs off the parent `ticket.workflowType`, which `buildTicketMembershipWhere` can be extended to gate on).

## Decisions

### D-001: Context-size computation per turn
- **Decision**: Claude turn context = `input_tokens + cache_read_tokens + cache_creation_tokens` (attended window). Codex turn context = `input_token_count` (already inclusive of cached). Gemini peak = cumulative `input + cacheRead + cacheCreation` max snapshot; turnCount/avg stay null. Mistral: all three stay null.
- **Rationale**: Matches spec assumption A-002 ("what the model had to attend to at that turn") using only attributes already ingested (FR-005). The asymmetry between Claude and Codex is already baked into `otlp-processor.ts` (see comment at lines 673–678) and this feature inherits it rather than fighting it.
- **Alternatives considered**: (a) Include `output_tokens` in context size — rejected because output is produced, not attended. (b) Use a single per-agent formula — rejected because Claude and Codex expose different attribute semantics and normalizing them would require inventing values; cleaner to follow the same branch split the processor already has.

### D-002: Persist peak/average as materialized columns, not computed on read
- **Decision**: Store `peakContextTokens`, `avgContextTokens`, `turnCount` as three `Int?` columns on `Job`.
- **Rationale**: Spec Auto-Resolved Decision #2 (high confidence, same pattern as existing telemetry). Analytics query reads are O(1) per job instead of iterating per-turn events that we don't store. Existing telemetry ingestion is already streaming-friendly.
- **Alternatives considered**: A `JobTurn` child table with one row per turn — rejected as over-engineering for a validation-phase metric; the ticket itself flags this.

### D-003: Running sum kept in-memory per request, not stored on the row
- **Decision**: The per-batch OTLP handler computes `peak`, `sum`, `turnCount` for the batch, then merges into the DB. The merge recovers `avg` by reading the prior `avgContextTokens * turnCount` to reconstruct the prior sum, adds the new sum, divides by the new total turnCount, and writes both `avg` and `turnCount`. No persistent "sum" column.
- **Rationale**: Keeps the schema to three columns (per D-002) instead of four. The reconstruction is exact for integer tokens in practice because `avg` is rounded before write; to avoid drift, we round only on the **final** write (integer-arithmetic over the reconstructed sum). Alternative: store `contextSumTokens: BigInt?` as a fourth column — acceptable but heavier for a ticket that explicitly warns thresholds and columns will be revisited.
- **Alternatives considered**: Store the sum explicitly. Acceptable fallback if reconstruction drift becomes measurable in integration tests; revisit before ship.

### D-004: Threshold defaults (conservative)
- **Decision**: `healthy < 60% of context window`, `warning 60–80%`, `danger ≥ 80%`. Constants live in `lib/telemetry/context-window.ts`.
- **Rationale**: Spec Auto-Resolved Decision #1 (CONSERVATIVE fallback, low confidence). Slightly over-sensitive is acceptable for an observability hypothesis; we will re-tune after two-three weeks of data.
- **Alternatives considered**: Absolute token thresholds (e.g., > 160k) — rejected because context windows vary across models and "near the limit" is what matters, not an absolute number.

### D-005: Model → context window registry
- **Decision**: New module `lib/telemetry/context-window.ts` with `MODEL_CONTEXT_WINDOWS` mapping seed model IDs. Unknown model returns `null` from `getContextWindow(model)` and the UI hides the pill (neutral branch per FR-008 "no placeholder"). Seed entries: all Claude 4.x = 200_000; `gpt-5*` family = 400_000; `gpt-5.4` = 400_000; Gemini 2.5 Pro/Flash = 1_048_576; Gemini 2.0 Flash = 1_048_576. Mistral models left unmapped (Mistral jobs have no per-turn peak anyway, so no pill regardless).
- **Rationale**: Spec assumption A-003 — the `model` field is already on the Job, so it's the natural key. Centralized so tuning is one file. Seed numbers are public documented context windows as of 2026-04, easy to update.
- **Alternatives considered**: Reading context window from the agent's telemetry if it ever emits one — out of scope; FR-005 forbids new runner-side instrumentation.

### D-006: Analytics filters — command type, workflow type, quality-score bucket
- **Decision**: Reuse the existing `AnalyticsFilters` object (`range`, `outcome`, `agent`) and add three **client-side** dimensions to the new chart only: `command` (string), `workflowType` ('FULL'|'QUICK'|'ALL'), `qualityBucket` ('poor'|'fair'|'good'|'excellent'|'all'). These are scoped to the peak-context chart, not a project-wide dashboard filter, to avoid rippling filter changes through every existing chart.
- **Rationale**: FR-011 specifies these are required for the peak-context visualization specifically. Scoping them to the chart keeps the existing dashboard behavior identical (FR-013). The quality bucket reuses `getScoreThreshold` from `lib/quality-score.ts`.
- **Alternatives considered**: Add all three to the global `AnalyticsFilters` — rejected because every existing chart would then need to decide whether to respect them (scope creep + test burden).

### D-007: UI degradation for null values
- **Decision**: In `jobs-timeline.tsx`, render the peak-context pill **only** when `job.peakContextTokens != null && job.model != null && getContextWindow(job.model) != null`. If model is known but context window is unknown, render the pill with neutral styling and a tooltip "context window unknown". Average + turn count rows in the expanded breakdown render only when both `avgContextTokens != null` and `turnCount != null`.
- **Rationale**: FR-008 ("render nothing, no placeholder"); FR-003 (turnCount can be set independently of model resolution). Covers the edge case "telemetry parsed but model column missing".
- **Alternatives considered**: Always render a grey "—" placeholder — rejected explicitly by spec.

## Context-window seed values (D-005)

| Model family | Context window (tokens) | Source |
|--------------|-------------------------|--------|
| `claude-opus-4-7` / `claude-opus-4-6` / `claude-sonnet-4-6` / `claude-haiku-4-5-*` | 200_000 | Anthropic public docs |
| `gpt-5-codex` / `gpt-5.3-codex` / `gpt-5.4` / `gpt-5` | 400_000 | OpenAI public docs |
| `gemini-2.5-pro` | 1_048_576 (1M) | Google public docs (consistent with the 200k tier gating in `estimateGeminiCost`) |
| `gemini-2.5-flash` / `gemini-2.0-flash` | 1_048_576 | Google public docs |
| Mistral models | Not mapped — no per-turn data anyway | n/a |

The registry is a plain `Record<string, number>` with exact-string lookup and a substring-fallback helper (`normalizeGeminiModel` at `otlp-processor.ts:411–428` is the pattern to mirror for fuzzy Gemini model IDs).
