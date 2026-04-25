# Tasks: Track Per-Turn Context Size On Jobs To Analyze Context Rot Impact On Quality

**Input**: Design documents from `/specs/AIB-734-track-per-turn/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`

**Tests**: Test tasks are included by default. Existing coverage is extended in place before implementation work.

**Organization**: Tasks are grouped by user story so each slice can be implemented and validated independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the persistent schema and shared classification helper used by the ticket timeline and analytics.

- [x] T001 Add nullable `peakContextSize`, `averageContextSize`, and `turnCount` fields to `prisma/schema.prisma` ✅ DONE
- [x] T002 Generate the Prisma migration for the new job context columns in `prisma/migrations/` ✅ DONE
- [x] T003 [P] Create shared context-risk and quality-bucket utilities in `lib/analytics/context-metrics.ts` ✅ DONE

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend the shared TypeScript contracts and request parsing that all later story work depends on.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [x] T004 [P] Extend `TicketJobWithTelemetry` with nullable context metrics and `contextRiskBand` in `lib/types/job-types.ts` ✅ DONE
- [x] T005 [P] Extend analytics filter and response contracts for command, workflow type, quality bucket, distributions, and excluded counts in `lib/analytics/types.ts` ✅ DONE
- [x] T006 Extend analytics query parsing and validation for context filters in `app/api/projects/[projectId]/analytics/route.ts` ✅ DONE

**Checkpoint**: Database, shared classifiers, and public TypeScript contracts are ready.

---

## Phase 3: User Story 1 - Inspect Context Risk On A Ticket (Priority: P1) 🎯 MVP

**Goal**: Show per-job context metrics and a risk indicator in the ticket timeline when supported telemetry exists, while leaving unsupported or historical jobs visually neutral.

**Independent Test**: Open a ticket with supported, unsupported, and historical completed jobs and confirm only supported jobs show peak context size, average context size, turn count, and a healthy/warning/danger indicator.

### Tests for User Story 1

- [x] T007 [P] [US1] Extend supported/unsupported/partial turn-level telemetry ingestion coverage in `tests/integration/telemetry/agent-agnostic.test.ts` ✅ DONE
- [x] T008 [P] [US1] Extend ticket jobs API coverage for nullable context fields and derived risk bands in `tests/integration/jobs/ticket-jobs.test.ts` ✅ DONE
- [x] T009 [P] [US1] Extend ticket stats rendering coverage for per-job context metrics and hidden indicators in `tests/unit/components/ticket-stats.test.tsx` ✅ DONE

### Implementation for User Story 1

- [x] T010 [US1] Persist normalized peak context size, average context size, and turn count during telemetry ingestion in `lib/telemetry/otlp-processor.ts` ✅ DONE
- [x] T011 [US1] Extend ticket job selection and response shaping with context metrics and `contextRiskBand` in `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts` ✅ DONE
- [x] T012 [US1] Render context metrics, units, and healthy/warning/danger badges in `components/ticket/jobs-timeline.tsx` ✅ DONE

**Checkpoint**: Ticket job history exposes and renders context-risk data without inventing values for unsupported jobs.

---

## Phase 4: User Story 2 - Analyze Context Rot Trends Across A Project (Priority: P2)

**Goal**: Add project analytics slices that chart peak-context distribution and let members compare context size by command type, workflow type, and quality-score bucket.

**Independent Test**: Open project analytics for a seeded project and confirm the peak-context charts update correctly for time range, command, workflow type, and quality bucket filters.

### Tests for User Story 2

- [x] T013 [P] [US2] Extend context analytics route coverage for command and workflow filtering plus peak-context distributions in `tests/integration/analytics/analytics-route.test.ts` ✅ DONE
- [x] T014 [P] [US2] Extend quality-bucket comparison coverage for context metrics in `tests/integration/analytics/quality-score.test.ts` ✅ DONE
- [x] T015 [P] [US2] Extend dashboard filter and chart rendering coverage for context analytics controls in `tests/unit/components/analytics-dashboard.test.tsx` ✅ DONE

### Implementation for User Story 2

- [x] T016 [US2] Extend filter-aware context aggregations, peak distributions, and quality-bucket summaries in `lib/analytics/queries.ts` ✅ DONE
- [x] T017 [P] [US2] Create the peak-context distribution chart in `components/analytics/context-peak-distribution-chart.tsx` ✅ DONE
- [x] T018 [P] [US2] Create the quality-bucket context comparison chart in `components/analytics/context-quality-bucket-chart.tsx` ✅ DONE
- [x] T019 [US2] Add command, workflow type, and quality bucket controls plus the new context charts to `components/analytics/analytics-dashboard.tsx` ✅ DONE

**Checkpoint**: Analytics shows context-risk distributions and filterable project-level comparisons.

---

## Phase 5: User Story 3 - Trust Missing-Data Behavior (Priority: P3)

**Goal**: Preserve historical and unsupported jobs as valid records while making empty context slices explicit instead of misleading.

**Independent Test**: Compare a historical job, an unsupported-agent job, and a supported job across the ticket timeline and analytics; only the supported job should contribute context metrics, and empty slices should explain why data is absent.

### Tests for User Story 3

- [x] T020 [P] [US3] Extend analytics empty-slice and excluded-count coverage for missing context or quality data in `tests/integration/analytics/analytics-route.test.ts` ✅ DONE
- [x] T021 [P] [US3] Extend ticket jobs API coverage for historical and unsupported jobs remaining null-safe in `tests/integration/jobs/ticket-jobs.test.ts` ✅ DONE
- [x] T022 [P] [US3] Extend dashboard empty-state coverage for slices with no compatible context telemetry in `tests/unit/components/analytics-dashboard.test.tsx` ✅ DONE

### Implementation for User Story 3

- [x] T023 [US3] Enforce null-safe context eligibility, excluded counts, and empty-slice metadata in `lib/analytics/queries.ts` ✅ DONE
- [x] T024 [US3] Reuse explicit no-context empty-state messaging in `components/analytics/analytics-dashboard.tsx` and `components/analytics/empty-state.tsx` ✅ DONE
- [x] T025 [US3] Keep unsupported and historical jobs visually neutral when context metrics are absent in `components/ticket/jobs-timeline.tsx` ✅ DONE

**Checkpoint**: Missing context data is handled consistently and transparently across both ticket and analytics experiences.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency work after the story slices are in place.

- [x] T026 Regenerate the Prisma client after the schema update from `prisma/schema.prisma` ✅ DONE
- [x] T027 [P] Align context metric labels, threshold copy, and shared terminology across `lib/analytics/context-metrics.ts`, `components/ticket/jobs-timeline.tsx`, and `components/analytics/analytics-dashboard.tsx` ✅ DONE

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) starts immediately.
- Foundational (Phase 2) depends on Phase 1 and blocks all story work.
- User Story 1 (Phase 3) depends on Phase 2.
- User Story 2 (Phase 4) depends on Phase 2.
- User Story 3 (Phase 5) depends on User Story 1 and User Story 2 because it validates the final missing-data behavior across both surfaces.
- Polish (Phase 6) depends on the stories you plan to ship.

### User Story Dependencies

- US1 is the MVP and should land first.
- US2 can start once foundational work is done, but it is safer to sequence it after US1 if one team owns both telemetry and analytics.
- US3 should land after US1 and US2 because its acceptance criteria span both the ticket timeline and analytics empty states.

### Within Each User Story

- Write the listed tests first and confirm they fail.
- Finish persistence and shared shaping before UI rendering.
- Keep each story independently demoable before moving to the next one.

## Parallel Opportunities

- Phase 1: `T003` can run while the schema and migration work are being prepared.
- Phase 2: `T004` and `T005` can run in parallel after `T003`.
- US1: `T007`, `T008`, and `T009` can run in parallel; `T010` can proceed once Phase 2 is done.
- US2: `T013`, `T014`, and `T015` can run in parallel; `T017` and `T018` can run in parallel once the shared analytics contracts are in place.
- US3: `T020`, `T021`, and `T022` can run in parallel after US1 and US2 behavior is stable.

## Parallel Example: User Story 1

```bash
# Parallel test preparation for US1
T007 tests/integration/telemetry/agent-agnostic.test.ts
T008 tests/integration/jobs/ticket-jobs.test.ts
T009 tests/unit/components/ticket-stats.test.tsx
```

## Parallel Example: User Story 2

```bash
# Parallel chart implementation for US2
T017 components/analytics/context-peak-distribution-chart.tsx
T018 components/analytics/context-quality-bucket-chart.tsx
```

## Parallel Example: User Story 3

```bash
# Parallel missing-data regression coverage for US3
T020 tests/integration/analytics/analytics-route.test.ts
T021 tests/integration/jobs/ticket-jobs.test.ts
T022 tests/unit/components/analytics-dashboard.test.tsx
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1.
2. Complete Phase 2.
3. Complete Phase 3.
4. Validate the ticket timeline against supported and unsupported telemetry before expanding scope.

### Incremental Delivery

1. Ship the schema, shared helpers, and contracts first.
2. Deliver US1 so ticket-level diagnosis works immediately.
3. Add US2 for project-level analysis once the stored telemetry is visible.
4. Finish with US3 to harden missing-data trust and empty-state behavior.

### Suggested MVP Scope

- Phase 1
- Phase 2
- Phase 3 (US1)

## Notes

- Every task uses the required checklist format: `- [ ] T### [P?] [US?] Description with file path`.
- Existing tests are extended instead of duplicated wherever the research inventory identified a matching file.
- New files are limited to justified gaps from research: `lib/analytics/context-metrics.ts`, `components/analytics/context-peak-distribution-chart.tsx`, and `components/analytics/context-quality-bucket-chart.tsx`.
