---
description: "Actionable, dependency-ordered implementation tasks for Fix Gemini Telemetry: Native Telemetry Parsing and Cost Estimation"
---

# Tasks: Fix Gemini Telemetry: Native Telemetry Parsing and Cost Estimation

**Input**: Design documents from `/home/runner/work/ai-board/ai-board/target/specs/AIB-626-fix-gemini-telemetry/`
**Prerequisites**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-626-fix-gemini-telemetry/plan.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-626-fix-gemini-telemetry/spec.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-626-fix-gemini-telemetry/research.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-626-fix-gemini-telemetry/data-model.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-626-fix-gemini-telemetry/contracts/`

**Tests**: Test tasks are included by default per constitution requirements.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified independently.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel when the task touches different files and has no dependency on incomplete tasks
- **[Story]**: User story label for story-specific phases only
- Every task below uses validated existing file paths or a justified new migration path under `prisma/migrations/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Align shared agent and analytics typing so downstream telemetry, pricing, and filter work uses one Gemini-aware source of truth.

- [X] T001 Update `/home/runner/work/ai-board/ai-board/target/app/lib/utils/agent-resolution.ts` and `/home/runner/work/ai-board/ai-board/target/lib/analytics/types.ts` to expose a shared authoritative Gemini-capable agent source for analytics and telemetry consumers. ✅ DONE
- [X] T002 [P] Extend `/home/runner/work/ai-board/ai-board/target/tests/unit/agent-resolution.test.ts` and `/home/runner/work/ai-board/ai-board/target/tests/unit/agent-schema.test.ts` to lock the shared agent definitions before feature implementation. ✅ DONE

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the shared persistence and normalization primitives required by every Gemini telemetry story.

**⚠️ CRITICAL**: No user story work should start until this phase is complete.

- [X] T003 Update `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma`, generate an additive migration in `/home/runner/work/ai-board/ai-board/target/prisma/migrations/`, and regenerate the Prisma client so `Job` can persist `thinkingTokens` distinctly from cache and output usage. ✅ DONE
- [X] T004 [P] Refactor `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts` shared Gemini normalization helpers to accept native usage buckets, explicit `costStatus`, and duplicate-suppression inputs before story-specific behavior is added. ✅ DONE
- [X] T005 [P] Extend `/home/runner/work/ai-board/ai-board/target/lib/analytics/types.ts` and `/home/runner/work/ai-board/ai-board/target/lib/analytics/aggregations.ts` so analytics can carry separate thinking, cache-read, and cache-creation usage without conflation. ✅ DONE

**Checkpoint**: Shared schema, route primitives, and analytics types are ready for story implementation.

---

## Phase 3: User Story 1 - Review accurate Gemini job telemetry (Priority: P1) 🎯 MVP

**Goal**: Capture Gemini native telemetry faithfully and make the normalized usage and tool data available to existing analytics views.

**Independent Test**: Run a Gemini-backed telemetry ingestion flow and confirm analytics-visible job data preserves input, output, thinking, cache, tool, and duration values without double-counting repeated payloads.

### Tests for User Story 1

**NOTE**: Extend existing tests first and ensure they fail before implementation.

- [X] T006 [P] [US1] Extend `/home/runner/work/ai-board/ai-board/target/tests/integration/telemetry/agent-agnostic.test.ts` with Gemini ingestion cases for separate thinking/cache categories, partial payloads, delayed merges, and repeated final payload suppression. ✅ DONE

### Implementation for User Story 1

- [X] T007 [P] [US1] Extend `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh` so `collect_gemini_telemetry()` extracts native Gemini usage buckets, tool activity, model, and duration from `stream-json` output into the batch payload contract. ✅ DONE
- [X] T008 [US1] Extend `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts` Gemini batch validation and merge logic to persist native usage categories, preserve partial telemetry, and reject repeated final payload double-counting. ✅ DONE
- [X] T009 [US1] Extend `/home/runner/work/ai-board/ai-board/target/lib/analytics/queries.ts` and `/home/runner/work/ai-board/ai-board/target/lib/analytics/aggregations.ts` so Gemini jobs contribute normalized token and tool metrics to existing analytics outputs without collapsing thinking into cache or output totals. ✅ DONE

**Checkpoint**: Gemini telemetry is stored accurately and appears in analytics with correct usage and tool data.

---

## Phase 4: User Story 2 - Compare Gemini cost with other agents (Priority: P2)

**Goal**: Estimate Gemini cost centrally for supported Gemini model families while keeping unsupported-model pricing explicitly unavailable.

**Independent Test**: Post Gemini telemetry for supported and unsupported models, then verify the stored job cost and analytics overview match centralized pricing rules and preserve `costsIncomplete` when pricing is unavailable.

### Tests for User Story 2

- [X] T010 [P] [US2] Extend `/home/runner/work/ai-board/ai-board/target/tests/integration/telemetry/agent-agnostic.test.ts` with Gemini pricing scenarios for 2.5 Pro, 2.5 Flash, 2.0 Flash, and unsupported models that must remain `UNAVAILABLE`. ✅ DONE
- [X] T011 [P] [US2] Extend `/home/runner/work/ai-board/ai-board/target/tests/integration/analytics/analytics-route.test.ts` with Gemini cost aggregation and `overview.costsIncomplete` scenarios covering mixed supported and unsupported Gemini history. ✅ DONE

### Implementation for User Story 2

- [X] T012 [US2] Extend `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts` with Gemini model-family pricing tables and per-category cost calculation for input, output, thinking, cache-read, and cache-creation usage. ✅ DONE
- [X] T013 [US2] Extend `/home/runner/work/ai-board/ai-board/target/lib/analytics/queries.ts` and `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/analytics/route.ts` so Gemini jobs remain visible in analytics totals while unsupported Gemini pricing keeps cost summaries explicitly incomplete. ✅ DONE

**Checkpoint**: Supported Gemini jobs receive server-estimated cost, and unsupported Gemini jobs remain visible with explicit unavailable-cost semantics.

---

## Phase 5: User Story 3 - Filter analytics by supported agents without manual maintenance (Priority: P3)

**Goal**: Remove analytics-local hardcoded agent options and derive filter options from shared supported-agent definitions plus real project history.

**Independent Test**: Seed project history for multiple agents, load analytics, and verify the server returns the correct `availableAgents` set and the dashboard renders those options without any hardcoded Gemini-specific UI list.

### Tests for User Story 3

- [X] T014 [P] [US3] Extend `/home/runner/work/ai-board/ai-board/target/tests/integration/analytics/analytics-route.test.ts` with authoritative agent-option scenarios that prove `availableAgents` comes from shared supported-agent definitions plus project job history. ✅ DONE
- [X] T015 [P] [US3] Extend `/home/runner/work/ai-board/ai-board/target/tests/unit/components/analytics-dashboard.test.tsx` to verify the dashboard renders server-provided agent options, including Gemini, without client-side hardcoded fallbacks. ✅ DONE

### Implementation for User Story 3

- [X] T016 [US3] Extend `/home/runner/work/ai-board/ai-board/target/lib/analytics/queries.ts` and `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/analytics/route.ts` to replace the analytics-local hardcoded agent loop with the shared authoritative supported-agent source and history-aware option generation. ✅ DONE
- [X] T017 [US3] Extend `/home/runner/work/ai-board/ai-board/target/components/analytics/analytics-dashboard.tsx` to consume the authoritative server-provided agent options without introducing any client-maintained agent list. ✅ DONE

**Checkpoint**: Analytics agent filters stay aligned with the supported-agent source and historical project data without manual maintenance.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Close remaining regressions and verify the feature end-to-end across all affected agents.

- [X] T018 [P] Re-run and stabilize `/home/runner/work/ai-board/ai-board/target/tests/integration/telemetry/agent-agnostic.test.ts`, `/home/runner/work/ai-board/ai-board/target/tests/integration/analytics/analytics-route.test.ts`, `/home/runner/work/ai-board/ai-board/target/tests/unit/components/analytics-dashboard.test.tsx`, `/home/runner/work/ai-board/ai-board/target/tests/unit/agent-resolution.test.ts`, and `/home/runner/work/ai-board/ai-board/target/tests/unit/agent-schema.test.ts` to confirm Claude, Codex, Mistral, and Gemini regressions are covered together. ✅ DONE
- [X] T019 Run `bun run type-check` and `bun run lint` from `/home/runner/work/ai-board/ai-board/target/` and fix any issues in the touched files before shipping the Gemini telemetry changes. ✅ DONE

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately.
- **Foundational (Phase 2)**: Depends on T001-T002 and blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on T003-T005.
- **User Story 2 (Phase 4)**: Depends on T003-T005 and on US1 telemetry normalization being in place through T007-T009.
- **User Story 3 (Phase 5)**: Depends on T001-T005; it can begin after the foundation is complete and can proceed in parallel with US2.
- **Polish (Phase 6)**: Depends on all selected story phases being complete.

### User Story Dependencies

- **US1**: No dependency on other user stories after the foundational phase.
- **US2**: Depends on US1 because Gemini cost estimation uses the normalized native usage categories and duplicate-safe merge path added for telemetry.
- **US3**: Independent of US2 and only depends on the shared supported-agent source and analytics query foundation; it should still be validated with Gemini-backed history from US1.

### Within Each User Story

- Tests must be written and fail before implementation tasks in the same story.
- Route and schema prerequisites come before analytics or UI consumption.
- Runner emission changes must land before full Gemini telemetry ingestion is considered complete.
- Each story should be verified independently before moving to the next priority if working sequentially.

### Parallel Opportunities

- T002 can run in parallel with T001 once the shared-agent change approach is agreed.
- T004 and T005 can run in parallel after T003 defines the persisted thinking-token shape.
- In US1, T006 and T007 can run in parallel; T008 depends on the schema foundation, and T009 depends on the normalized route output from T008.
- In US2, T010 and T011 can run in parallel, then T012 and T013 proceed sequentially on the pricing path.
- In US3, T014 and T015 can run in parallel, then T016 and T017 proceed sequentially on the server-to-UI filter path.

---

## Parallel Example: User Story 1

```bash
# Launch Gemini telemetry validation and runner extraction work together:
Task: "T006 [US1] Extend tests/integration/telemetry/agent-agnostic.test.ts with Gemini ingestion edge cases"
Task: "T007 [US1] Extend .github/scripts/run-agent.sh Gemini stream-json extraction"
```

## Parallel Example: User Story 2

```bash
# Launch Gemini pricing test coverage together:
Task: "T010 [US2] Extend tests/integration/telemetry/agent-agnostic.test.ts with supported and unsupported Gemini pricing cases"
Task: "T011 [US2] Extend tests/integration/analytics/analytics-route.test.ts with Gemini cost aggregation coverage"
```

## Parallel Example: User Story 3

```bash
# Launch analytics filter verification together:
Task: "T014 [US3] Extend tests/integration/analytics/analytics-route.test.ts for authoritative availableAgents sourcing"
Task: "T015 [US3] Extend tests/unit/components/analytics-dashboard.test.tsx for server-provided filter rendering"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 for native Gemini telemetry extraction, ingestion, and analytics visibility.
3. Validate US1 independently with the telemetry integration suite.
4. Stop for review before adding pricing and filter-maintenance improvements.

### Incremental Delivery

1. Finish Setup + Foundational work to establish shared schema and analytics types.
2. Deliver US1 as the MVP for accurate Gemini telemetry.
3. Add US2 for centralized Gemini cost estimation.
4. Add US3 for authoritative analytics filter sourcing.
5. Finish with the regression, type-check, and lint gate in Phase 6.

### Parallel Execution Strategy

1. Execute Setup and Foundational phases sequentially.
2. After the foundation is complete, run US1 first to establish Gemini-native telemetry.
3. Start US3 in parallel with US2 once the shared analytics foundation exists.
4. Reserve Phase 6 for final regression coverage and repository quality gates.

---

## Notes

- All test tasks extend real existing files discovered in `/home/runner/work/ai-board/ai-board/target/specs/AIB-626-fix-gemini-telemetry/research.md`.
- The only justified new path is the additive Prisma migration under `/home/runner/work/ai-board/ai-board/target/prisma/migrations/` because no existing migration can be edited safely.
- Every task follows the required checklist format: checkbox, sequential ID, optional `[P]`, required story label for story phases, and explicit file path.
