# Implementation Plan: Track Per-Turn Context Size on Jobs (AIB-725)

**Branch**: `AIB-725-track-per-turn` | **Date**: 2026-04-24 | **Spec**: `specs/AIB-725-track-per-turn/spec.md`

## Summary

Add three nullable integer columns to `Job` (`peakContextTokens`, `avgContextTokens`, `turnCount`) populated from per-event OTLP telemetry already ingested by `lib/telemetry/otlp-processor.ts`. Surface the peak as a threshold-styled pill in the ticket jobs timeline, add average + turn-count rows to the existing expandable job breakdown, and add a peak-context distribution histogram to the project analytics dashboard. Mistral jobs (and any agent without per-turn telemetry) leave all three fields null and the UI hides the pill entirely — no placeholders, no zeros.

The feature is **additive only**: the OTLP processor's existing DELTA/CUMULATIVE merge semantics carry over, thresholds are centralized behind `lib/telemetry/context-window.ts` for later tuning, and no existing telemetry field, chart, or endpoint contract changes.

## Technical Context

**Language/Version**: TypeScript 5.9 strict, Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, Prisma 6.x, TanStack Query v5.95.2, Recharts 3.x, shadcn/ui + Radix
**Storage**: PostgreSQL 14+ via Prisma; three new nullable INTEGER columns on `Job`; no new tables, no new indexes
**Testing**: Vitest unit + integration (Testing Trophy priority); no new Playwright E2E (component + integration coverage is sufficient per constitution §III)
**Target Platform**: Vercel serverless (Next.js) + Postgres; identical to existing job-telemetry surface
**Project Type**: Web (Next.js App Router — a single repo with `app/`, `components/`, `lib/`, `prisma/`, `tests/`)
**Performance Goals**: Ingestion adds O(1) arithmetic per OTLP logRecord; analytics query scans already-bounded completed-job set (same cost envelope as `getTokenUsage`). No new DB round-trips in the hot path. 15 s dashboard polling preserved.
**Constraints**: Three `Int?` columns on a high-cardinality table (spec Decision #2 accepts this). No backfill (FR-014). No new runner-side instrumentation (FR-005). UI must render nothing — no placeholder — when any of the three values is null (FR-008).
**Scale/Scope**: Feature adds 1 Prisma migration, ~3 new files (`lib/telemetry/context-window.ts`, `components/analytics/peak-context-distribution-chart.tsx`, context-window unit test), extensions to `lib/telemetry/otlp-processor.ts`, `lib/analytics/queries.ts`, `lib/analytics/types.ts`, `components/ticket/jobs-timeline.tsx`, `components/analytics/analytics-dashboard.tsx`, `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts`, `lib/types/job-types.ts`. Integration-test extensions to `tests/integration/telemetry/agent-agnostic.test.ts` and `tests/integration/analytics/analytics-route.test.ts`; one new component test for the timeline.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. TypeScript-First** — ✅ Three new fields typed as `number | null` end-to-end (DB → Prisma model → `TicketJobWithTelemetry` → UI props). All new helpers have explicit return types. No `any`.
- **II. Component-Driven** — ✅ New chart is its own file under `components/analytics/` following the existing per-chart convention (`token-usage-chart.tsx`, `workflow-distribution-chart.tsx`). Pill rendering is an inline JSX block in `jobs-timeline.tsx` — <40 lines, single-use — per the "prefer cohesion" rule it stays inline rather than being extracted.
- **III. Test-Driven** — ✅ Extends existing integration suites (`agent-agnostic.test.ts`, `analytics-route.test.ts`) per "search existing tests FIRST". One new file (`jobs-timeline.test.tsx`) because no timeline component test exists today — verified by `find tests -name "*jobs-timeline*"`. No new E2E (decision-tree item 4 does not apply — no browser-only capability required).
- **IV. Security-First** — ✅ No user input enters the new code paths. OTLP attribute values are already validated by `otlpAttributeSchema`; new integer aggregates are derived via `parseIntAttribute` (returns 0 on invalid). No secrets. Authentication helpers (`validateWorkflowAuth`, `verifyProjectAccess`) unchanged.
- **V. Database Integrity** — ✅ Single `prisma.job.update` atomic write for all aggregated telemetry (new fields included in the same `updateData` object). Nullable `Int?` columns with no default match the existing `thinkingTokens`, etc. pattern. No raw SQL. No backfill. Migration is a pure ALTER (safe on Postgres 14+).
- **V. Spec Clarification Guardrails** — ✅ Spec was auto-resolved under AUTO policy and includes four documented decisions (thresholds conservative, fields on Job, project-level analytics, null = hidden). Plan inherits those without contradiction and adds design-level decisions D-001..D-007 (research.md).

No violations. No entries required in the Complexity Tracking table.

## Project Structure

### Documentation (this feature)

```
specs/AIB-725-track-per-turn/
├── plan.md               # this file
├── research.md           # Phase 0 — existing files, patterns, decisions
├── data-model.md         # Phase 1 — Job model diff, migration plan
├── contracts/
│   ├── jobs-api.md               # GET /api/projects/:projectId/tickets/:id/jobs
│   ├── analytics-api.md          # GET /api/projects/:projectId/analytics
│   └── telemetry-ingestion.md    # POST /api/telemetry/v1/logs — new side-effects
└── tasks.md              # Phase 2 — produced by /ai-board.tasks
```

(No `workflows/` subdirectory — this feature has no internal workflow processes beyond the existing OTLP ingestion it extends. The spec's "Internal Processes" section describes an **extension** to the existing ingestion, not a new workflow artifact.)

### Source Code (repository root)

Files to create:

```
lib/telemetry/context-window.ts                          # MODEL_CONTEXT_WINDOWS, getContextWindow, getPeakContextThresholdState, getPeakContextColor
components/analytics/peak-context-distribution-chart.tsx # Recharts histogram + local command/workflow/qualityBucket filters
prisma/migrations/<timestamp>_add_job_context_metrics/migration.sql
tests/unit/telemetry/context-window.test.ts              # threshold boundaries, unknown model fallback
tests/unit/components/jobs-timeline.test.tsx             # pill rendering, null-hiding, threshold variants
```

Files to extend:

```
prisma/schema.prisma                                           # +3 columns on Job (lines ~45–54 area)
lib/telemetry/otlp-processor.ts                                # TelemetryMetrics + logRecord loop + updateJobMetrics (lines 33–289 region)
lib/types/job-types.ts                                         # TicketJobWithTelemetry +3 fields
app/api/projects/[projectId]/tickets/[id]/jobs/route.ts        # select +3 fields (line 131–154)
lib/analytics/queries.ts                                       # +getPeakContextDistribution, wire into getAnalyticsData
lib/analytics/types.ts                                         # +PeakContextDistribution, extend AnalyticsData
components/analytics/analytics-dashboard.tsx                   # render new chart in grid (lines 182–233)
components/ticket/jobs-timeline.tsx                            # peak pill in JobRow header; avg + turnCount rows in CollapsibleContent
tests/integration/telemetry/agent-agnostic.test.ts             # per-turn peak/avg/turnCount assertions across Claude/Codex/Gemini/Mistral
tests/integration/analytics/analytics-route.test.ts            # peakContextDistribution in response
tests/unit/components/analytics-dashboard.test.tsx             # new chart renders / empty state
```

**Structure Decision**: The feature fits the existing single-project Next.js App Router layout (`app/`, `components/`, `lib/`, `prisma/`, `tests/`). No new top-level directory. The per-feature `components/analytics/*-chart.tsx` pattern and the `lib/telemetry/*.ts` grouping are both pre-existing and this feature extends them in place.

## Implementation Phases

### Phase A — Schema + ingestion (P1 backbone)

Enables every downstream change to read from real columns instead of mocks.

1. **Migration**: `prisma/migrations/<timestamp>_add_job_context_metrics/migration.sql`
   - Three `ALTER TABLE "Job" ADD COLUMN ... INTEGER;` statements. Pattern reference: `prisma/migrations/20260413103000_add_job_thinking_tokens/migration.sql`.
2. **Prisma model**: extend `Job` in `prisma/schema.prisma` (insert next to `thinkingTokens` at line ~48). Run `bunx prisma generate`.
3. **Model-context-window module**: create `lib/telemetry/context-window.ts` per research.md D-004/D-005. Export:
   - `MODEL_CONTEXT_WINDOWS: Record<string, number>` — exact-match seed entries.
   - `getContextWindow(model: string | null): number | null` — exact lookup + Gemini substring fallback (mirror `normalizeGeminiModel` at `otlp-processor.ts:411–428`).
   - `getPeakContextThresholdState(peak: number | null, model: string | null): 'healthy' | 'warning' | 'danger' | 'unknown'`.
   - `getPeakContextColor(state)` returning static Tailwind class strings (pattern: `lib/quality-score.ts:95–106`).
4. **OTLP processor extensions** (`lib/telemetry/otlp-processor.ts`):
   - Extend `TelemetryMetrics` with `peakContext: number`, `contextSum: number`, `turnCount: number` plus a CUMULATIVE-side equivalent (cumulative mode tracks only peak, not sum/turnCount — see D-001).
   - Inside the logRecord loop (lines 643–710), for each `isClaudeApiRequest` branch: compute `turnContext = inputTokens + cacheReadTokens + cacheCreationTokens` from the SAME attributes already parsed on lines 659–662; update `deltaMetrics.peakContext = Math.max(...)`, `contextSum += turnContext`, `turnCount += 1`.
   - For each `isCodexTokenEvent` branch: `turnContext = totalInputTokens` (the `input_token_count` attribute read at line 675, which is already inclusive of cached per the existing comment); same update.
   - For each `isGeminiEvent`: inside `mergeGeminiTelemetryRecord` (lines 125–161), compute `cumulativePeak = inputTokens + cacheReadTokens + cacheCreationTokens` and `cumulativeMetrics.peakContext = Math.max(existing, cumulativePeak)`. Do NOT increment `turnCount` or `contextSum` (cumulative snapshots are not per-turn events — see D-001).
   - Extend `updateJobMetrics` (lines 178–289): add `peakContextTokens`, `avgContextTokens`, `turnCount` to the `select` and to `updateData` using the reconstruction-based merge from data-model.md ("Running-merge semantics"). Only write the three fields when the incoming batch has `turnCount > 0` (DELTA) or the cumulative peak actually exceeds the stored one (CUMULATIVE) — **never** overwrite a non-null value with a null (FR-004).
   - Extend `batchPayloadSchema` — **not required**: Mistral has no per-turn data. Leave the schema as-is; the batch path will never write the three new fields, leaving them null forever for Mistral jobs (FR-004).
5. **Integration tests**: extend `tests/integration/telemetry/agent-agnostic.test.ts`:
   - Claude: single batch of 3 `claude_code.api_request` events with ascending input tokens → assert `peakContextTokens = max`, `avgContextTokens = round(sum/3)`, `turnCount = 3`.
   - Claude: two consecutive batches → assert cross-batch accumulation (peak is running max, turnCount is sum, avg is reconstructed correctly).
   - Codex: `input_token_count` events → assert peak = max single event.
   - Gemini: two cumulative snapshots → assert peak updates via max; `avgContextTokens` and `turnCount` remain null.
   - Mistral: batch payload → assert all three fields remain null (FR-004).
   - Pre-existing job with prior aggregated telemetry but no per-turn events in this batch → assert the three fields are unchanged (no null-over-value write).

### Phase B — Ticket UI (P1 + P3)

6. **Type extension**: `lib/types/job-types.ts` — add `peakContextTokens`, `avgContextTokens`, `turnCount` to `TicketJobWithTelemetry`.
7. **API select**: `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts` — add three fields to the `select` at lines 131–154. No other change.
8. **Timeline pill** (`components/ticket/jobs-timeline.tsx`): inside the `JobRow` header flex (between the cost pill at line 148 and the cancel button at line 153), add:
   - A render guard: `job.peakContextTokens != null && job.model != null` → render; else render nothing (FR-008).
   - Compute `state = getPeakContextThresholdState(job.peakContextTokens, job.model)`.
   - Render a compact pill using `Badge` (`components/ui/badge.tsx`) with `variant="outline"` + color classes from `getPeakContextColor(state)` (pattern reference: `components/ticket/quality-score-badge.tsx`).
   - Title/tooltip: `{formatAbbreviatedNumber(peak)} tokens · {pct}% of ${formatAbbreviatedNumber(contextWindow)} context window`.
   - `data-testid={`job-peak-context-${job.id}`}`.
9. **Breakdown rows** (`components/ticket/jobs-timeline.tsx` `CollapsibleContent` lines 200–226): extend the existing 2-column grid to also show:
   - "Avg Context" — render only if `avgContextTokens != null`, using `formatAbbreviatedNumber`.
   - "Turn Count" — render only if `turnCount != null`.
   - Both hidden (no row at all, not "—") when null. Layout stays visually unchanged for Mistral + pre-feature jobs (FR-009).
   - Update the `hasTelemetry` gate on line 101–105 so that a job with `turnCount != null` alone also expands (without this, a Gemini job with peak-only data would not show an expand chevron even though the avg/turn-count rows are skipped — fine because peak displays inline; but for a hypothetical future agent that emits only turn-count + avg, we still want expansion). Safe no-op addition: `|| job.turnCount != null`.
10. **Component test**: new file `tests/unit/components/jobs-timeline.test.tsx` covering:
    - Pill renders with neutral/warning/danger class strings for respective percent bands.
    - Pill does NOT render when `peakContextTokens` is null.
    - Pill does NOT render when `model` is null.
    - Pill does NOT render when `model` is not in `MODEL_CONTEXT_WINDOWS` (unknown model → `state === 'unknown'` → no pill; tooltip-only branch tested separately).
    - Expanded breakdown shows "Avg Context" and "Turn Count" rows for Claude job; omits both for Mistral job.

### Phase C — Analytics (P2)

11. **Query**: extend `lib/analytics/queries.ts` with `getPeakContextDistribution(projectId, filters, now)`:
    - Prisma `findMany` using `buildJobWhere(projectId, filters, now, [JobStatus.COMPLETED])`, selecting `id`, `peakContextTokens`, `model`, `command`, `qualityScore`, and `ticket.workflowType` via relation.
    - Returns `{ jobs: PeakContextJob[], hasData: boolean }`.
    - Wire into `getAnalyticsData` (line 629–687) alongside the other `Promise.all` queries.
12. **Types**: extend `lib/analytics/types.ts` with `PeakContextJob` + `PeakContextDistribution` and add `peakContextDistribution: PeakContextDistribution` to `AnalyticsData` (exact shape in `contracts/analytics-api.md`).
13. **Chart component**: create `components/analytics/peak-context-distribution-chart.tsx` — copy the structure of `components/analytics/token-usage-chart.tsx`:
    - `Card` + `CardHeader` + `CardContent` + `aurora-bg-subtle`.
    - Local state: `command` filter (`'all' | <command>`), `workflowType` filter (`'all' | 'FULL' | 'QUICK'`), `qualityBucket` filter (`'all' | 'Poor' | 'Fair' | 'Good' | 'Excellent'`). Three `Select` components from `@/components/ui/select`.
    - Derive filtered jobs client-side; bucket by percent-of-context-window using `getContextWindow` (contracts/analytics-api.md § Histogram bucketing).
    - Recharts `BarChart` with the seven buckets. Empty state when no jobs match.
14. **Dashboard integration**: add the new chart to the grid in `components/analytics/analytics-dashboard.tsx` — new `<div>` slot inside the existing grid (line ~200), adjacent to `CacheEfficiencyChart` or `WorkflowDistributionChart`. Pass `analytics.peakContextDistribution` and `emptyMessage`.
15. **Integration test extension**: extend `tests/integration/analytics/analytics-route.test.ts` to seed a mix of Claude jobs with varying `peakContextTokens` and a Mistral job with null, then assert:
    - `response.data.peakContextDistribution.jobs` length matches the filtered completed job count.
    - `hasData` is `true` when at least one job has a non-null peak.
    - Mistral-only seeded project returns `hasData: false` (FR-012).
16. **Component test extension**: extend `tests/unit/components/analytics-dashboard.test.tsx` to assert the new chart renders (mock `initialData.peakContextDistribution`) and that the empty state is shown when `hasData === false`.

## Testing Strategy

Per constitution §III decision tree and research.md "Existing Files":

| Concern | Test type | File |
|---------|-----------|------|
| Context-window lookup + threshold state (pure function) | Unit | `tests/unit/telemetry/context-window.test.ts` (new — no existing file covers this) |
| OTLP processor: Claude/Codex per-turn accumulation, cross-batch merge, Mistral/Gemini null behavior | Integration | `tests/integration/telemetry/agent-agnostic.test.ts` (extend — test builders already exist) |
| Analytics query: peakContextDistribution shape, filter scoping, empty state | Integration | `tests/integration/analytics/analytics-route.test.ts` (extend) |
| Analytics dashboard: new chart renders + empty state | Component | `tests/unit/components/analytics-dashboard.test.tsx` (extend) |
| Jobs timeline: pill visibility, threshold variants, breakdown rows | Component | `tests/unit/components/jobs-timeline.test.tsx` (new — no existing timeline component test) |
| End-to-end user flows | **No new E2E** | Existing `tests/e2e/tickets/*.spec.ts` cover ticket creation/workflow; peak-context UI is visible by component testing and doesn't require a real browser. Decision-tree item 4 (browser-required) does not apply. |

**Existing tests to NOT modify** (unrelated concerns per §III "don't mix concerns"):
- `tests/unit/telemetry/otlp-schema.test.ts` — schema is unchanged.
- `tests/unit/telemetry/aggregation.test.ts` — covers `aggregateJobTelemetry()` (cross-job, different domain).
- `tests/integration/tickets/timeline.test.ts` — covers the timeline API shape; the endpoint in scope here is `/jobs`, not `/timeline`. If the ticket detail modal happens to consume the timeline API for the same rendering path, extend it; otherwise leave unchanged.

## Complexity Tracking

*No Constitution Check violations → this table is empty.*
