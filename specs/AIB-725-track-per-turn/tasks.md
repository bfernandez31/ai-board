# Tasks: Track Per-Turn Context Size on Jobs (AIB-725)

**Input**: Design documents from `/specs/AIB-725-track-per-turn/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Test tasks are included by default (constitution). Only skip if the user explicitly instructs not to generate tests.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

This repository is a single Next.js App Router project: source under `app/`, `components/`, `lib/`, `prisma/`; tests under `tests/unit/`, `tests/integration/`, `tests/e2e/`. All paths below are repository-root-relative.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Feature-scoped setup — no project scaffolding needed (existing repo).

- [X] T001 Confirm migration timestamp + directory name `prisma/migrations/<timestamp>_add_job_context_metrics/` by using the next UTC timestamp greater than the latest existing migration folder under `prisma/migrations/`; record chosen name for use in T002.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Data plumbing (migration, schema, type, API select) and the shared `context-window` module + ingestion write path. These block every user story because without them no Job row has the three new fields and no UI surface can read them.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Schema + data layer

- [X] T002 Write migration SQL (three `ALTER TABLE "Job" ADD COLUMN ... INTEGER;` statements) in `prisma/migrations/<timestamp>_add_job_context_metrics/migration.sql`, following the pattern of `prisma/migrations/20260413103000_add_job_thinking_tokens/migration.sql`.
- [X] T003 Extend the `Job` model in `prisma/schema.prisma` with `peakContextTokens Int?`, `avgContextTokens Int?`, `turnCount Int?` (insert alongside `thinkingTokens` near line ~48), then run `bunx prisma generate` to refresh the client.
- [X] T004 Extend `TicketJobWithTelemetry` in `lib/types/job-types.ts` to include `peakContextTokens: number | null`, `avgContextTokens: number | null`, `turnCount: number | null`.
- [X] T005 Add `peakContextTokens`, `avgContextTokens`, `turnCount` to the Prisma `select` clause in `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts` (lines 131–154). No other changes to the handler.

### Shared telemetry module + tests

- [X] T006 [P] Create `lib/telemetry/context-window.ts` exporting `MODEL_CONTEXT_WINDOWS` (seed Claude 4.x=200_000; gpt-5*=400_000; Gemini 2.5 Pro/Flash and 2.0 Flash=1_048_576; Mistral unmapped), `getContextWindow(model: string | null): number | null` with exact-match plus Gemini substring fallback (mirror `normalizeGeminiModel` at `lib/telemetry/otlp-processor.ts:411–428`), `getPeakContextThresholdState(peak: number | null, model: string | null): 'healthy' | 'warning' | 'danger' | 'unknown'` using thresholds from research.md D-004 (<60% healthy, 60–80% warning, ≥80% danger), and `getPeakContextColor(state)` returning static Tailwind class strings (pattern: `lib/quality-score.ts:95–106`).
- [X] T007 [P] Create `tests/unit/telemetry/context-window.test.ts` covering: exact-match lookup for each seed family, Gemini substring fallback, unknown model returns `null` from `getContextWindow`, threshold boundaries (59.9% → healthy, 60% → warning, 79.9% → warning, 80% → danger, ≥95% → danger), `null` peak or unknown window → `'unknown'` state, and that `getPeakContextColor` returns literal static class strings per branch.

### OTLP ingestion write path + tests

- [X] T008 Extend `lib/telemetry/otlp-processor.ts` to populate the three new Job fields: add `peakContext: number`, `contextSum: number`, `turnCount: number` to `TelemetryMetrics` (DELTA) and a CUMULATIVE-side equivalent tracking only peak; inside the logRecord loop (lines 643–710) compute per-event `turnContext` for Claude (`input + cacheRead + cacheCreation`), Codex (`input_token_count`); update `deltaMetrics.peakContext = Math.max(...)`, `contextSum += turnContext`, `turnCount += 1`; inside `mergeGeminiTelemetryRecord` (lines 125–161) update cumulative `peakContext` via `Math.max` and leave `avgContextTokens`/`turnCount` null; extend `updateJobMetrics` (lines 178–289) to include the three fields in the `select` and in `updateData` using the running-merge formula from data-model.md (`newPeak = max(db, batch)`, `newTurnCount = (db ?? 0) + batch`, `oldSum = (db.avg ?? 0) * (db.turnCount ?? 0)`, `newSum = oldSum + batchSum`, `newAvg = round(newSum / newTurnCount)` only when `newTurnCount > 0`); never overwrite a non-null stored value with null (FR-004); all three written in the same `prisma.job.update` call atomically.
- [X] T009 Extend `tests/integration/telemetry/agent-agnostic.test.ts` with per-turn context assertions: (a) Claude — single batch of 3 `claude_code.api_request` events with ascending input tokens → assert `peakContextTokens = max`, `avgContextTokens = round(sum/3)`, `turnCount = 3`; (b) Claude — two consecutive batches → assert cross-batch accumulation (peak is running max, turnCount is sum, avg reconstructed correctly); (c) Codex — `input_token_count` events → assert peak = max single event; (d) Gemini — two cumulative snapshots → assert peak updates via max and `avgContextTokens`/`turnCount` remain null; (e) Mistral batch payload → assert all three fields remain null (FR-004); (f) pre-existing job with prior aggregated telemetry but no per-turn events in the current batch → assert the three fields remain unchanged (no null-over-value write).

**Checkpoint**: Foundation ready — after T001–T009 the Job row stores `peakContextTokens`/`avgContextTokens`/`turnCount` from real telemetry, the API exposes them, and the `context-window` module is available. User story work can now begin.

---

## Phase 3: User Story 1 — Peak context pill on job timeline (Priority: P1) 🎯 MVP

**Goal**: On each job row in the ticket's jobs timeline, show a compact pill with the peak per-turn context size, visually styled (neutral / warning / danger) based on the job model's context window. Mistral and pre-feature jobs render no pill.

**Independent Test**: Create a ticket, run a full-workflow job end-to-end with a Claude agent, open the ticket's jobs timeline, and verify: (1) the peak-context pill renders on the row with the correct value and a color class matching the threshold the peak crossed; (2) a Mistral job on the same timeline shows no pill; (3) a pre-feature job (fields null) shows no pill.

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation.**
**RULE (constitution): "Search existing tests FIRST — extend, don't duplicate." No existing `jobs-timeline` component test exists (verified), so a new file is warranted.**

- [X] T010 [US1] Create `tests/unit/components/jobs-timeline.test.tsx` with pill test cases: renders with neutral class string when `peakContextTokens` is well under 60% of the model's context window; renders with warning class string when between 60%–80%; renders with danger class string at/above 80%; does NOT render when `peakContextTokens` is null; does NOT render when `model` is null; does NOT render when `model` is not in `MODEL_CONTEXT_WINDOWS` (unknown → state `'unknown'`); asserts `data-testid={`job-peak-context-${job.id}`}` and that the tooltip text contains both the abbreviated peak and the `%` of context window.

### Implementation for User Story 1

- [X] T011 [US1] In `components/ticket/jobs-timeline.tsx` `JobRow` header flex (between the cost pill at line 148 and the cancel button at line 153), add an inline `Badge` (`components/ui/badge.tsx`) rendered only when `job.peakContextTokens != null && job.model != null && getContextWindow(job.model) != null`; compute state via `getPeakContextThresholdState(job.peakContextTokens, job.model)`; apply classes from `getPeakContextColor(state)` with `variant="outline"`; set `title` to `{formatAbbreviatedNumber(peak)} tokens · {pct}% of {formatAbbreviatedNumber(contextWindow)} context window`; set `data-testid={`job-peak-context-${job.id}`}`. Pattern reference: `components/ticket/quality-score-badge.tsx`.

**Checkpoint**: At this point User Story 1 is fully functional — operators see the peak-context pill inline on every job row that has data, and Mistral / pre-feature jobs show no pill.

---

## Phase 4: User Story 2 — Peak context distribution on project analytics (Priority: P2)

**Goal**: On the project analytics dashboard, render a peak-context-size distribution histogram scoped to the project's completed jobs, with chart-local filters for command, workflow type, and quality-score bucket (D-006).

**Independent Test**: Seed the project with a mix of Claude jobs spanning several commands and quality scores, open the project analytics page, and verify: (1) the histogram renders seven buckets; (2) toggling each chart-local filter (command / workflowType / qualityBucket) updates the displayed distribution; (3) a Mistral-only project renders an explicit empty state ("No per-turn data for this selection yet").

### Tests for User Story 2

- [X] T012 [P] [US2] Extend `tests/integration/analytics/analytics-route.test.ts` to seed a mix of Claude jobs with varying `peakContextTokens` and at least one Mistral job with null values; assert: `response.data.peakContextDistribution.jobs` length equals the filtered completed-job count (per `buildJobWhere`); each returned row has the contract shape `{jobId, peakContextTokens, model, command, workflowType, qualityScore}`; `hasData === true` when ≥1 job has a non-null peak; a Mistral-only seeded project returns `hasData: false` (FR-012); dashboard-level filters (`range`, `outcome`, `agent`) propagate to the rows returned.
- [X] T013 [P] [US2] Extend `tests/unit/components/analytics-dashboard.test.tsx` to assert the new `PeakContextDistributionChart` slot renders when `initialData.peakContextDistribution.hasData === true` and that the empty state message renders when `hasData === false`.

### Implementation for User Story 2

- [X] T014 [P] [US2] Extend `lib/analytics/types.ts` with `PeakContextJob` and `PeakContextDistribution` interfaces exactly per `contracts/analytics-api.md`, and add `peakContextDistribution: PeakContextDistribution` to `AnalyticsData`.
- [X] T015 [US2] Extend `lib/analytics/queries.ts` with `getPeakContextDistribution(projectId, filters, now)`: Prisma `findMany` over `buildJobWhere(projectId, filters, now, [JobStatus.COMPLETED])` selecting `id`, `peakContextTokens`, `model`, `command`, `qualityScore`, and `ticket: { select: { workflowType: true } }`; map rows to `PeakContextJob[]`; compute `hasData = jobs.some(j => j.peakContextTokens != null)`; wire into `getAnalyticsData` (lines 629–687) inside the existing `Promise.all`. Depends on T014.
- [X] T016 [P] [US2] Create `components/analytics/peak-context-distribution-chart.tsx` following the structure of `components/analytics/token-usage-chart.tsx`: `Card` + `CardHeader` + `CardContent` + `aurora-bg-subtle`; three `Select` controls (`@/components/ui/select`) for `command` (`'all' | <command>`), `workflowType` (`'all' | 'FULL' | 'QUICK'`), `qualityBucket` (`'all' | 'poor' | 'fair' | 'good' | 'excellent'`); derive filtered jobs client-side from `props.data.jobs`; bucket each by `peakContextTokens / getContextWindow(job.model)` into the seven fixed buckets from `contracts/analytics-api.md` (`<20%`, `20-40%`, `40-60%`, `60-80%` warning, `80-95%` danger, `≥95%` danger, `unknown`); render a Recharts `BarChart`; render the two empty-state messages per FR-012 when no matching jobs or when all matching jobs have null peaks.
- [X] T017 [US2] In `components/analytics/analytics-dashboard.tsx`, add a new grid slot inside the existing `<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">` (line ~200), adjacent to `CacheEfficiencyChart` or `WorkflowDistributionChart`, rendering `<PeakContextDistributionChart data={analytics.peakContextDistribution} />`. Depends on T016 and T015 (type must be present on `AnalyticsData`).

**Checkpoint**: At this point Users Story 1 and 2 both work independently — the timeline pill is live and the analytics dashboard shows the distribution with chart-local filters.

---

## Phase 5: User Story 3 — Average context + turn count in job breakdown (Priority: P3)

**Goal**: In the expanded per-job breakdown (within the timeline), display "Avg Context" and "Turn Count" rows alongside the existing token / cost / duration breakdown. Rows are hidden entirely (no "—" placeholder) when either value is null.

**Independent Test**: Expand a completed Claude job row in the timeline and verify "Avg Context" and "Turn Count" rows render with the correct values; expand a completed Mistral job row and verify both rows are absent (layout otherwise unchanged).

### Tests for User Story 3

- [X] T018 [US3] Extend `tests/unit/components/jobs-timeline.test.tsx` (created in T010) with breakdown-row cases: given a Claude job with `avgContextTokens` and `turnCount` set, the expanded breakdown shows "Avg Context" and "Turn Count" rows with `formatAbbreviatedNumber`-formatted values; given a Mistral job (both null), both rows are absent from the expanded breakdown and the surrounding grid layout is unchanged (FR-009); given a Gemini job with `peakContextTokens` set but `avgContextTokens === null` and `turnCount === null`, both rows are absent.

### Implementation for User Story 3

- [X] T019 [US3] In `components/ticket/jobs-timeline.tsx` `CollapsibleContent` (lines 200–226), within the existing breakdown grid, add an "Avg Context" cell rendered only when `avgContextTokens != null` (using `formatAbbreviatedNumber`) and a "Turn Count" cell rendered only when `turnCount != null`. Both hidden (no cell emitted, not a "—" placeholder) when null, preserving layout for Mistral + pre-feature jobs (FR-008, FR-009).
- [X] T020 [US3] In `components/ticket/jobs-timeline.tsx`, update the `hasTelemetry` gate (lines 101–105) to also expand when `job.turnCount != null` (safe no-op addition: `|| job.turnCount != null`) so a hypothetical future agent that emits only turn-count + avg still gets an expand chevron.

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T021 [P] Run `bun run type-check` and `bun run lint` from repo root; resolve any errors introduced by the new code paths before commit (CLAUDE.md "Commit Rules": never bypass; fix even pre-existing errors).
- [X] T022 [P] Run `bun run test:unit tests/unit/telemetry/context-window.test.ts`, `bun run test:unit tests/unit/components/jobs-timeline.test.tsx`, and `bun run test:unit tests/unit/components/analytics-dashboard.test.tsx` and confirm all pass.
- [X] T023 Run `bun run test:integration tests/integration/telemetry/agent-agnostic.test.ts` and `bun run test:integration tests/integration/analytics/analytics-route.test.ts` and confirm all pass.
- [X] T024 Smoke-check the dev server: `bun run dev`, open a ticket with a completed Claude job and confirm the pill renders with the threshold-matching color, the expanded row shows "Avg Context" + "Turn Count", and the project analytics page shows the new distribution chart with all three filters operational.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup. **BLOCKS all user stories.**
- **User Stories (Phases 3–5)**: All depend on Foundational (Phase 2) completing.
  - US1 (P1) is independent of US2 and US3 and can ship alone (MVP).
  - US2 (P2) is independent of US1 and US3.
  - US3 (P3) shares one file (`components/ticket/jobs-timeline.tsx`) with US1 — see "Within each user story" below.
- **Polish (Phase 6)**: Depends on all shipped user stories.

### User Story Dependencies

- **US1 (P1)**: Only depends on Foundational (T003–T006). No dependency on US2 or US3.
- **US2 (P2)**: Only depends on Foundational (T002–T008 — needs the columns populated in the DB to have data to query, though query + chart can be implemented against zero-data projects). No dependency on US1 or US3.
- **US3 (P3)**: Only depends on Foundational (same columns). Shares `jobs-timeline.tsx` with US1 → if US1 is in flight, US3 should land after or be merged carefully in the same branch.

### Within Each User Story

- Tests MUST be written and initially FAIL before implementation (constitution §III TDD).
- Types/models before services before endpoints before UI.
- Within US2 specifically: T014 (types) before T015 (query) before T017 (dashboard wiring); T016 (chart component) can run in parallel with T015 because they are different files.

### Parallel Opportunities

- T006 (context-window module) and T007 (context-window tests) are in different files — T007 can be written first (TDD). T006 and T007 are both marked [P] and can run in parallel once T002–T005 are unblocked (they don't depend on the schema for compile).
- T008 and T009 operate on `lib/telemetry/otlp-processor.ts` and `tests/integration/telemetry/agent-agnostic.test.ts` respectively — different files, can run in parallel (TDD: write T009 first, watch it fail, then T008).
- Within US2: T012 and T013 (different test files) can run in parallel; T014 and T016 (types file vs new chart file) can run in parallel.
- US1, US2, and US3 can all proceed in parallel after Foundational completes — except that US1 and US3 both edit `components/ticket/jobs-timeline.tsx` and must be serialized on that file.

---

## Parallel Example: User Story 2

```bash
# Tests in parallel:
Task: "Extend tests/integration/analytics/analytics-route.test.ts with peakContextDistribution assertions"
Task: "Extend tests/unit/components/analytics-dashboard.test.tsx with new chart slot assertions"

# Implementation in parallel (types + chart component — different files):
Task: "Extend lib/analytics/types.ts with PeakContextJob / PeakContextDistribution"
Task: "Create components/analytics/peak-context-distribution-chart.tsx"
# Then sequentially:
Task: "Extend lib/analytics/queries.ts with getPeakContextDistribution (depends on types)"
Task: "Wire the chart into components/analytics/analytics-dashboard.tsx (depends on types + chart)"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 (T001).
2. Complete Phase 2 (T002–T009) — the schema, type, API select, context-window module, and the OTLP ingestion write path are all in.
3. Complete Phase 3 (T010–T011) — the timeline pill is live.
4. **STOP and VALIDATE**: Run a Claude job end-to-end, confirm the pill renders with correct color; confirm Mistral and pre-feature jobs show no pill. Ship.

### Incremental Delivery

1. Foundational + US1 → MVP (see above).
2. Add US2 (T012–T017) → validate analytics distribution independently → ship.
3. Add US3 (T018–T020) → validate expanded breakdown rows independently → ship.
4. Run Phase 6 polish + full test sweep before the final merge.

### Parallel Execution Strategy

After Phase 2 completes, US1, US2, and US3 can proceed in parallel tracks. The only coordination needed is on `components/ticket/jobs-timeline.tsx`, edited by both US1 (T011) and US3 (T019, T020) — serialize those three tasks or land them in the same commit.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Every user story here is independently completable and testable.
- Verify tests fail before implementing.
- Commit after each task or logical group.
- Stop at any checkpoint to validate story independently.
- Feature is **additive only**: no existing telemetry field, chart, endpoint contract, or E2E flow changes (FR-013). No new Playwright E2E per constitution §III decision tree.
