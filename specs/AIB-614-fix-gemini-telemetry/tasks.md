# Tasks: Fix Gemini Telemetry — Native OTLP Parsing and Cost Estimation

**Input**: Design documents from `/specs/AIB-614-fix-gemini-telemetry/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included by default (constitution).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Database Schema)

**Purpose**: Add the `thinkingTokens` field to the Job model — blocks all downstream work

- [ ] T001 Add `thinkingTokens Int?` field to Job model in `prisma/schema.prisma` (after `cacheCreationTokens`, before `costUsd`)
- [ ] T002 Run Prisma migration (`bunx prisma migrate dev --name add-thinking-tokens`) and regenerate client (`bunx prisma generate`)

---

## Phase 2: Foundational (Gemini Pricing & Cost Estimation)

**Purpose**: Core pricing table and estimation function that US1 and US2 depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Add `GEMINI_PRICING` record (gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash) with 5-tier pricing (input, output, thinking, cached, cacheCreation) in `app/api/telemetry/v1/logs/route.ts` (after existing pricing tables)
- [ ] T004 Add `estimateGeminiCost(model, inputTokens, outputTokens, thinkingTokens, cachedTokens)` function with prefix matching in `app/api/telemetry/v1/logs/route.ts` (follow `estimateOpenAICost()` / `estimateMistralCost()` pattern)
- [ ] T005 Extend `TelemetryMetrics` interface to add `thinkingTokens: number` and update `createEmptyMetrics()` to include `thinkingTokens: 0` in `app/api/telemetry/v1/logs/route.ts`

**Checkpoint**: Pricing infrastructure ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Gemini Job Cost Visibility (Priority: P1) MVP

**Goal**: Completed Gemini jobs show accurate cost estimated from token usage and model pricing

**Independent Test**: Run a Gemini job on any ticket, verify the job record shows a non-zero cost estimate calculated from token usage and the appropriate Gemini model pricing

### Tests for User Story 1

- [ ] T006 [P] [US1] Create Gemini cost estimation unit tests in `tests/unit/telemetry/gemini-cost.test.ts`: known model correct calculation, unknown model returns null, prefix match (e.g. `gemini-2.5-pro-preview`), zero thinking tokens, cost formula accuracy per model
- [ ] T007 [P] [US1] Extend `tests/integration/telemetry/agent-agnostic.test.ts` with Gemini cost tests: known model cost estimated, unknown model cost null, explicit costUsd uses provided value

### Implementation for User Story 1

- [ ] T008 [US1] Extend `batchPayloadSchema` in `app/api/telemetry/v1/logs/route.ts` to add `thinkingTokens: z.number().int().nonnegative().optional()`
- [ ] T009 [US1] Update `processBatchPayload()` in `app/api/telemetry/v1/logs/route.ts`: map `data.thinkingTokens` to `metrics.thinkingTokens`, replace Gemini cost skip logic with `estimateGeminiCost()` call when `agent === 'GEMINI'` and tokens present
- [ ] T010 [US1] Update `updateJobMetrics()` in `app/api/telemetry/v1/logs/route.ts`: add `thinkingTokens` to select clause and accumulation logic (`thinkingTokens: (job.thinkingTokens || 0) + metrics.thinkingTokens`)

**Checkpoint**: Gemini jobs now have cost estimation — verify unit and integration tests pass

---

## Phase 4: User Story 2 — Gemini Token and Tool Metrics via Telemetry (Priority: P1)

**Goal**: Telemetry events are parsed into accurate token breakdowns (input, output, thinking, cache) and tool usage, matching Claude/Codex parity

**Independent Test**: Send a Gemini batch telemetry payload, verify the resulting job record has accurate token counts including thinking tokens and tool lists

### Tests for User Story 2

- [ ] T011 [P] [US2] Extend `tests/integration/telemetry/agent-agnostic.test.ts` with Gemini token tests: thinking tokens accumulated, default to 0 when absent, multiple batches accumulate metrics

### Implementation for User Story 2

- [ ] T012 [US2] Update `collect_gemini_telemetry()` in `.github/scripts/run-agent.sh`: extract thinking tokens, cache read tokens, and cache creation tokens from stream-json; add new fields to batch payload; remove `costStatus: "UNAVAILABLE"` from payload
- [ ] T013 [US2] Extend `TicketJobWithTelemetry` interface in `lib/types/job-types.ts` to add `thinkingTokens: number | null`
- [ ] T014 [P] [US2] Extend `TicketTelemetry` interface in `lib/types/comparison.ts` to add `thinkingTokens: number`
- [ ] T015 [US2] Update `aggregateJobTelemetry()` in `lib/comparison/telemetry-extractor.ts` to accumulate `thinkingTokens` from jobs

**Checkpoint**: Gemini telemetry parsing is complete with thinking token support — verify integration tests pass

---

## Phase 5: User Story 3 — Gemini Analytics Dashboard Parity (Priority: P2)

**Goal**: Analytics dashboard displays Gemini token breakdown (including thinking tokens), cost trends, and tool distribution identical to other agents

**Independent Test**: With completed Gemini jobs, open analytics, filter by Gemini, verify all chart sections populate with data including thinking tokens

### Tests for User Story 3

- [ ] T016 [P] [US3] Extend `tests/integration/analytics/analytics-route.test.ts` with test: token breakdown includes thinking tokens when Gemini jobs present

### Implementation for User Story 3

- [ ] T017 [US3] Add `thinkingTokens: number` to `TokenBreakdown` interface in `lib/analytics/types.ts`
- [ ] T018 [US3] Update `getTokenUsage()` in `lib/analytics/queries.ts` to aggregate `thinkingTokens` alongside other token types
- [ ] T019 [US3] Add "Thinking" bar to token usage chart in `components/analytics/token-usage-chart.tsx` with appropriate color

**Checkpoint**: Analytics dashboard shows Gemini thinking tokens — verify integration test passes

---

## Phase 6: User Story 4 — Dynamic Agent Filter in Analytics (Priority: P2)

**Goal**: Analytics agent filter shows only agents with actual job data, derived from database rather than hardcoded list

**Independent Test**: In a project with only Claude and Gemini jobs, verify the filter shows exactly those two agents plus "All"

### Tests for User Story 4

- [ ] T020 [P] [US4] Extend `tests/integration/analytics/analytics-route.test.ts` with test: agent filter with only Claude+Gemini jobs returns only those agents in `availableAgents`

### Implementation for User Story 4

- [ ] T021 [P] [US4] Replace hardcoded Zod agent enum in `app/api/projects/[projectId]/analytics/route.ts` with dynamic derivation from Prisma `Agent` enum: `z.enum(['all', ...Object.values(Agent)])`
- [ ] T022 [P] [US4] Replace hardcoded `VALID_AGENTS` Set in `app/projects/[projectId]/analytics/page.tsx` with dynamic derivation from Prisma `Agent` enum
- [ ] T023 [US4] Update `getAvailableAgents()` in `lib/analytics/queries.ts`: initialize `counts` Map from `Object.values(Agent)` and replace hardcoded agent iteration loop

**Checkpoint**: Agent filter is fully dynamic — verify integration test passes

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and regression prevention

- [ ] T024 Run `bun run type-check` and fix any TypeScript errors across all modified files
- [ ] T025 Run `bun run lint` and fix any linting issues across all modified files
- [ ] T026 Run full test suite (`bun run test:unit` and `bun run test:integration`) to verify zero regressions on existing Claude, Codex, and Mistral telemetry

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (Prisma schema must be migrated)
- **US1 (Phase 3)**: Depends on Phase 2 (needs pricing table and estimation function)
- **US2 (Phase 4)**: Depends on Phase 3 (needs batch schema changes and `updateJobMetrics` changes)
- **US3 (Phase 5)**: Depends on Phase 1 (needs `thinkingTokens` field); can parallel with US1/US2
- **US4 (Phase 6)**: Depends on Phase 2 only; can parallel with US1/US2/US3
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependencies on other stories
- **US2 (P1)**: After US1 — shares modified files (`route.ts`, types)
- **US3 (P2)**: After Phase 1 — independent of US1/US2 (different files: analytics types/queries/chart)
- **US4 (P2)**: After Phase 2 — fully independent (different files: analytics route/page/queries)

### Within Each User Story

- Tests written FIRST, verify they FAIL before implementation
- Schema/type changes before service logic
- Service logic before endpoint/UI changes

### Parallel Opportunities

- T006 and T007 (US1 tests) can run in parallel
- T013 and T014 (US2 type updates) can run in parallel
- T021 and T022 (US4 route + page updates) can run in parallel
- US3 and US4 can execute in parallel (no shared files)
- US3 can start in parallel with US1/US2 (only needs Phase 1)

---

## Parallel Example: User Story 1

```bash
# Launch tests in parallel:
Task T006: "Create Gemini cost unit tests in tests/unit/telemetry/gemini-cost.test.ts"
Task T007: "Extend agent-agnostic.test.ts with Gemini cost integration tests"

# Then sequential implementation:
Task T008: "Extend batchPayloadSchema with thinkingTokens"
Task T009: "Update processBatchPayload() with Gemini cost estimation"
Task T010: "Update updateJobMetrics() with thinkingTokens accumulation"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (schema migration)
2. Complete Phase 2: Foundational (pricing table + estimation)
3. Complete Phase 3: User Story 1 (cost visibility)
4. **STOP and VALIDATE**: Gemini jobs show estimated costs
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational -> Infrastructure ready
2. Add US1 (cost visibility) -> Test independently -> MVP!
3. Add US2 (token metrics) -> Test independently -> Full telemetry parity
4. Add US3 (analytics display) + US4 (dynamic filter) in parallel -> Dashboard parity
5. Polish -> Final validation

### Parallel Execution Strategy

1. Complete Setup + Foundational sequentially
2. Once Foundational is done:
   - Stream A: US1 -> US2 (shared files in route.ts)
   - Stream B: US3 + US4 in parallel (independent files)
3. Polish after all stories complete

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Existing Claude, Codex, and Mistral telemetry must not be altered (FR-009)
