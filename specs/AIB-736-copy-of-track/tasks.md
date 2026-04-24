# Tasks: Track Per-Turn Context Size on Jobs

**Input**: Design documents from `/specs/AIB-736-copy-of-track/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-contract.md

**Tests**: Included by default (constitution).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- All file paths are relative to repository root

---

## Phase 1: Setup (Schema Migration)

**Purpose**: Add the three context metric columns to the Job model so all downstream work has its data foundation.

- [x] T001 Add peakContextTokens (Int?), avgContextTokens (Int?), and turnCount (Int?) fields to the Job model in `prisma/schema.prisma` and run `bunx prisma migrate dev --name add_context_metrics` to generate the migration

**Checkpoint**: Schema updated — three nullable integer columns exist on the Job table.

---

## Phase 2: User Story 2 — Record Context Metrics from Telemetry (Priority: P1) 🎯 MVP

**Goal**: Automatically compute and persist peak context tokens, average context tokens, and turn count from per-turn telemetry spans during job execution. This is the data foundation all other stories depend on.

**Independent Test**: Send simulated OTLP telemetry payloads with known per-turn input_tokens values through the ingestion endpoint and verify the job record stores correct computed values.

### Tests for User Story 2

- [x] T002 [US2] Extend `tests/integration/jobs/status.test.ts` with scenarios that simulate OTLP telemetry containing per-turn input_tokens on `claude_code.api_request` events, then verify peakContextTokens, avgContextTokens, and turnCount are correctly computed and persisted on the job record — include multi-batch merge, single-turn, and Mistral/Gemini null-preservation cases
- [x] T003 [P] [US2] Extend `tests/integration/jobs/ticket-jobs.test.ts` to verify the three new context metric fields are returned in the GET `/api/projects/:projectId/tickets/:id/jobs` response when populated, and are null when the job has no context metrics

### Implementation for User Story 2

- [x] T004 [US2] Extend TelemetryMetrics interface to add peakContextTokens (number), contextTokensSum (number), and turnCount (number) fields, and update createEmptyMetrics() to initialize them to 0 in `lib/telemetry/otlp-processor.ts`
- [x] T005 [US2] Extend Claude event processing: on each `claude_code.api_request` event, extract input_tokens and update deltaMetrics.peakContextTokens (via Math.max), deltaMetrics.contextTokensSum (running sum), and deltaMetrics.turnCount (increment) in `lib/telemetry/otlp-processor.ts`
- [x] T006 [US2] Extend Codex event processing: on each `codex.sse_event` with `response.completed`, use totalInputTokens (before subtracting cached) to update peakContextTokens, contextTokensSum, and turnCount in `lib/telemetry/otlp-processor.ts`
- [x] T007 [US2] Extend updateJobMetrics() to merge context metrics across batches: peak via Math.max with existing, avg recomputed from (existingAvg × existingTurnCount + newSum) / totalTurnCount, turnCount via addition — only write fields when metrics.turnCount > 0 in `lib/telemetry/otlp-processor.ts`
- [x] T008 [P] [US2] Add peakContextTokens (number | null), avgContextTokens (number | null), and turnCount (number | null) to the TicketJobWithTelemetry interface in `lib/types/job-types.ts`
- [x] T009 [P] [US2] Add `peakContextTokens: true`, `avgContextTokens: true`, `turnCount: true` to the Prisma select clause in `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts`

**Checkpoint**: Context metrics are computed from telemetry and persisted on jobs. The API returns them. US2 acceptance scenarios pass.

---

## Phase 3: User Story 1 — View Context Health on Individual Job (Priority: P1)

**Goal**: Show a color-coded context-health pill on each job in the timeline view — green/healthy (peak < 50K), yellow/warning (50K–100K), or red/danger (≥ 100K). Hidden when context data is null.

**Independent Test**: Complete a job with known telemetry data and verify the timeline displays the correct color-coded indicator with peak context value and turn count.

### Tests for User Story 1

- [x] T010 [US1] Create unit tests for getContextHealthTier() verifying threshold boundaries (49999→healthy, 50000→warning, 99999→warning, 100000→danger) and CONTEXT_HEALTH_CONFIG mapping in `tests/unit/context-health.test.ts` (no existing file covers this domain)

### Implementation for User Story 1

- [x] T011 [US1] Add getContextHealthTier() function and CONTEXT_HEALTH_CONFIG record (healthy/warning/danger with ctp color classes and labels) to `lib/analytics/aggregations.ts`
- [x] T012 [US1] Add context-health pill to the JobRow header in `components/ticket/jobs-timeline.tsx`: render after the model badge when job.peakContextTokens != null, showing abbreviated peak value and turn count, colored by tier — hidden when null (FR-006)

**Checkpoint**: Job timeline shows at-a-glance context health indicators. US1 acceptance scenarios pass.

---

## Phase 4: User Story 3 — Analyze Context-Size Distribution in Project Analytics (Priority: P2)

**Goal**: Add a context-health distribution bar chart to the project analytics dashboard showing peak context size distribution across completed jobs, with filtering by command type, workflow type, and quality-score bucket.

**Independent Test**: Seed jobs with known context metrics and verify the analytics chart renders correct distribution buckets with proper filtering and empty-state handling.

### Tests for User Story 3

- [ ] T013 [P] [US3] Extend `tests/integration/analytics/analytics-route.test.ts` with scenarios that seed jobs with known context metrics and verify the contextHealth distribution buckets, averagePeak, totalJobsWithData, filtering by contextCommand/contextWorkflowType/contextQualityBucket, null-exclusion, and empty-state response
- [ ] T014 [P] [US3] Extend `tests/unit/components/analytics-dashboard.test.tsx` to verify the context-health chart renders when contextHealth data is present and advancedAnalytics is enabled, and is hidden when advancedAnalytics is disabled or data is null/empty

### Implementation for User Story 3

- [ ] T015 [P] [US3] Add ContextBucket interface ({ bucket: string; count: number }), ContextHealthAnalytics interface ({ distribution, averagePeak, totalJobsWithData }), and extend AnalyticsData with optional contextHealth field in `lib/analytics/types.ts`
- [ ] T016 [P] [US3] Add getContextSizeBucket() helper (0–25K, 25–50K, 50–75K, 75–100K, 100–150K, 150K+) and getQualityScoreBucket() helper (Excellent 90–100, Good 70–89, Fair 50–69, Poor 30–49, Critical 0–29) to `lib/analytics/aggregations.ts`
- [ ] T017 [US3] Add getContextHealthAnalytics() query function following the getQualityScoreAnalytics pattern — query completed jobs with peakContextTokens not null, apply optional command/workflowType/qualityBucket filters, bucket into distribution ranges, compute averagePeak — and integrate into getAnalyticsData() Promise.all in `lib/analytics/queries.ts`
- [ ] T018 [P] [US3] Create context-health distribution bar chart component following the CostByStageChart pattern: BarChart with bucket labels on X-axis, count on Y-axis, bars colored by health tier (green for 0–50K, yellow for 50–100K, red for 100K+), empty state card, custom tooltip in `components/analytics/context-health-chart.tsx`
- [ ] T019 [US3] Integrate ContextHealthChart into the analytics dashboard grid, gated behind advancedAnalytics subscription and non-null contextHealth data, spanning md:col-span-2 in `components/analytics/analytics-dashboard.tsx`

**Checkpoint**: Analytics dashboard shows context-health distribution chart with filtering. US3 acceptance scenarios pass.

---

## Phase 5: User Story 4 — Context Metrics in Expanded Job Detail (Priority: P3)

**Goal**: Display peak context, average context, and turn count in the expanded job detail view alongside existing telemetry fields (tokens, cost, duration).

**Independent Test**: Expand a job with known context metrics and verify all three values display correctly with human-readable formatting; expand a job with null metrics and verify the section is hidden.

### Implementation for User Story 4

- [ ] T020 [US4] Add a context metrics grid section (peak context, avg context, turn count with formatAbbreviatedNumber formatting) to the CollapsibleContent in `components/ticket/jobs-timeline.tsx`, rendered after the token breakdown grid only when job.peakContextTokens != null — hidden for null-metric jobs (FR-006)

**Checkpoint**: Expanded job detail shows context metrics alongside existing telemetry. US4 acceptance scenarios pass.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all stories.

- [ ] T021 [P] Run `bun run type-check` and `bun run lint` to verify no type errors or lint violations across all modified files
- [ ] T022 Run `bun run test:unit` and `bun run test:integration` to verify all new and existing tests pass with no regressions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **US2 (Phase 2)**: Depends on Phase 1 — BLOCKS all subsequent user stories (data foundation)
- **US1 (Phase 3)**: Depends on Phase 2 (needs context data in API responses)
- **US3 (Phase 4)**: Depends on Phase 2 (needs context data for aggregation)
- **US4 (Phase 5)**: Depends on Phase 2 (needs context data for display)
- **US1, US3, US4 (Phases 3–5)**: Can proceed in parallel after Phase 2 completes
- **Polish (Phase 6)**: Depends on all user story phases

### User Story Dependencies

- **US2 (P1)**: Foundation — must complete first. No dependency on other stories.
- **US1 (P1)**: Depends on US2 for data. Independent of US3, US4.
- **US3 (P2)**: Depends on US2 for data. Independent of US1, US4.
- **US4 (P3)**: Depends on US2 for data. Independent of US1, US3. Note: modifies same file as US1 (`jobs-timeline.tsx`) — execute after US1 to avoid merge conflicts.

### Within Each User Story

- Tests written first — verify they FAIL before implementation
- Type definitions before business logic
- Business logic before UI components
- Core implementation before integration

### Parallel Opportunities

- **Phase 2**: T002 ∥ T003 (different test files); T008 ∥ T009 (different source files, both independent of T004–T007)
- **Phase 3**: T010 independent (only test in phase)
- **Phase 4**: T013 ∥ T014 (different test files); T015 ∥ T016 (different source files); T017 ∥ T018 (query and chart component are independent, both depend on T015/T016)
- **Cross-phase**: After Phase 2 completes, Phase 3 ∥ Phase 4 can run in parallel (different files); Phase 5 should follow Phase 3 (same file)

---

## Parallel Example: User Story 2

```
# Launch tests in parallel:
Task T002: "Extend status.test.ts with context metrics telemetry scenarios"
Task T003: "Extend ticket-jobs.test.ts with context metric field response scenarios"

# Sequential processor work (same file):
Task T004 → T005 → T006 → T007 (all in otlp-processor.ts)

# Launch type + API updates in parallel (different files, independent of processor):
Task T008: "Extend TicketJobWithTelemetry in job-types.ts"
Task T009: "Add fields to Prisma select in jobs/route.ts"
```

## Parallel Example: User Story 3

```
# Launch tests in parallel:
Task T013: "Extend analytics-route.test.ts"
Task T014: "Extend analytics-dashboard.test.tsx"

# Launch types + helpers in parallel:
Task T015: "Add analytics types in types.ts"
Task T016: "Add bucket helpers in aggregations.ts"

# Launch query + chart in parallel (after T015/T016):
Task T017: "Add getContextHealthAnalytics in queries.ts"
Task T018: "Create context-health-chart.tsx"

# Then integrate:
Task T019: "Integrate into analytics-dashboard.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 2 Only)

1. Complete Phase 1: Schema migration
2. Complete Phase 2: US2 — Record Context Metrics
3. **STOP and VALIDATE**: Verify telemetry ingestion computes correct metrics, API returns them
4. This alone delivers data collection — analytics and UI can follow incrementally

### Incremental Delivery

1. Phase 1 + Phase 2 → Data layer ready (US2 complete)
2. Add Phase 3 → Context health visible on timeline (US1 complete) → **Recommend shipping here**
3. Add Phase 4 → Analytics dashboard chart (US3 complete)
4. Add Phase 5 → Expanded detail view (US4 complete)
5. Each story adds value without breaking previous stories

### Parallel Execution Strategy

1. Complete Phase 1 + Phase 2 sequentially (foundation)
2. Once Phase 2 is done, launch Phase 3 and Phase 4 in parallel
3. After Phase 3 completes, Phase 5 can run (same file as US1)
4. Phase 6 after all stories complete

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [USn] label maps task to specific user story for traceability
- No new npm packages required
- No runner/agent changes required
- No new environment variables required
- All new DB columns are nullable — zero-downtime migration, no backfill
- Context metrics only populated for Claude and Codex agents; Gemini and Mistral jobs retain null values
