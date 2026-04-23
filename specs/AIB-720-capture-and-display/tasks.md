# Tasks: Capture and display agent execution logs

**Input**: Design documents from `/specs/AIB-720-capture-and-display/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/job-logs.openapi.yaml`

**Tests**: Test tasks are included by default per constitution requirements.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel with other tasks in the same phase when they touch different files
- **[Story]**: Maps work to a specific user story (`[US1]`, `[US2]`, `[US3]`)
- Every task includes an exact file path or directory path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the shared typed contracts and client query hooks that every story will build on.

- [ ] T001 Create shared upload/read Zod schemas and DTO types in `app/lib/schemas/job-logs.ts`
- [ ] T002 [P] Add job-log detail query keys in `app/lib/query-keys.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the persistence, normalization, workflow-capture, and cloning foundations that block all user stories.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [ ] T003 Extend the persisted data model with `JobExecutionLog` and `JobLogAvailability` in `prisma/schema.prisma`
- [ ] T004 Create the Prisma migration for `JobExecutionLog` and retention indexes in `prisma/migrations/`
- [ ] T005 Regenerate the Prisma client for the new log model from `prisma/schema.prisma`
- [ ] T006 [P] Implement compression, idempotent upsert, decompression, and pruning helpers in `lib/job-logs/storage.ts`
- [ ] T007 [P] Implement provider-specific transcript normalization for Claude, Codex, Mistral, and Gemini in `lib/job-logs/normalize.ts`
- [ ] T008 [P] Implement bounded preview-summary construction in `lib/job-logs/summary.ts`
- [ ] T009 Extend ticket-clone behavior to skip copying detailed log artifacts in `lib/db/tickets.ts`
- [ ] T010 Extend terminal capture bundling and payload sanitization in `.github/scripts/run-agent.sh`
- [ ] T011 [P] Insert pre-status log upload steps into `.github/workflows/speckit.yml`, `.github/workflows/quick-impl.yml`, `.github/workflows/iterate.yml`, `.github/workflows/verify.yml`, and `.github/workflows/ai-board-assist.yml`

**Checkpoint**: Persistence, normalization, and workflow capture are ready for story delivery.

---

## Phase 3: User Story 1 - Diagnose a failed job from the ticket view (Priority: P1) 🎯 MVP

**Goal**: Let a project member diagnose a failed job from the existing ticket experience with an inline summary and a full retained log view.

**Independent Test**: Complete a failed job, open the ticket detail view as a project member, confirm the failure summary is visible in the job surfaces, and confirm the full readable execution log opens without GitHub Actions access.

### Tests for User Story 1

- [ ] T012 [P] [US1] Extend terminal callback and idempotent upload sequencing coverage in `tests/integration/jobs/status.test.ts`
- [ ] T013 [P] [US1] Create workflow-upload and member-scoped log-detail contract coverage in `tests/integration/jobs/logs.test.ts`
- [ ] T014 [P] [US1] Extend full-log CTA, unavailable-state, and nested-dialog coverage in `tests/unit/components/ticket-detail-modal.test.tsx`

### Implementation for User Story 1

- [ ] T015 [US1] Implement the workflow-authenticated terminal log upload route in `app/api/jobs/[id]/logs/route.ts`
- [ ] T016 [US1] Extend terminal status handling to coordinate log capture state safely in `app/api/jobs/[id]/status/route.ts`
- [ ] T017 [US1] Implement the member-scoped full log retrieval route in `app/api/projects/[projectId]/jobs/[jobId]/logs/route.ts`
- [ ] T018 [US1] Extend ticket job payloads with `logAvailability`, `logSummary`, and retention metadata in `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts`
- [ ] T019 [P] [US1] Create the detailed full-log dialog UI in `components/ticket/job-log-dialog.tsx`
- [ ] T020 [US1] Wire failed-job summary actions and dialog entry points through `components/board/ticket-detail-modal.tsx` and `components/ticket/jobs-timeline.tsx`

**Checkpoint**: Failed jobs can be diagnosed from the ticket modal with both summary and full-detail access.

---

## Phase 4: User Story 2 - Review successful job activity without losing timeline clarity (Priority: P2)

**Goal**: Surface successful-job execution activity in a compact, readable way while keeping the ticket timeline concise.

**Independent Test**: Complete a successful job, verify the job surfaces show only a compact preview by default, and confirm the full dialog renders the normalized event sequence in execution order.

### Tests for User Story 2

- [ ] T021 [P] [US2] Extend successful-job preview payload coverage in `tests/integration/jobs/ticket-jobs.test.ts`
- [ ] T022 [P] [US2] Extend timeline preview serialization coverage in `tests/integration/tickets/timeline.test.ts`
- [ ] T023 [P] [US2] Create multi-agent normalization and summary extraction coverage in `tests/unit/job-log-normalizer.test.ts`

### Implementation for User Story 2

- [ ] T024 [US2] Extend the timeline event types and server-side event enrichment for log previews in `app/lib/types/conversation-event.ts` and `app/lib/utils/conversation-events.ts`
- [ ] T025 [US2] Extend timeline API serialization and client query consumption for preview-safe job events in `app/api/projects/[projectId]/tickets/[id]/timeline/route.ts` and `app/lib/hooks/queries/use-conversation-timeline.ts`
- [ ] T026 [US2] Render condensed successful-job previews in `components/timeline/job-event-timeline-item.tsx` and `components/ticket/conversation-timeline.tsx`
- [ ] T027 [US2] Extend `components/ticket/jobs-timeline.tsx` and `components/ticket/job-log-dialog.tsx` to show concise successful-job summaries and ordered full-event formatting

**Checkpoint**: Successful jobs remain compact in the timeline while full normalized execution detail is readable on demand.

---

## Phase 5: User Story 3 - Compare log context with existing telemetry (Priority: P3)

**Goal**: Add log context without regressing or obscuring the telemetry already shown for each job.

**Independent Test**: Load a ticket with populated telemetry and captured logs, then confirm cost, tokens, duration, tools, model, and quality score remain visible and unchanged while log summaries and detail access are added.

### Tests for User Story 3

- [ ] T028 [P] [US3] Extend telemetry-plus-log rendering coverage in `tests/unit/components/ticket-stats.test.tsx`
- [ ] T029 [P] [US3] Extend API coverage to confirm telemetry fields remain unchanged when log fields are present in `tests/integration/jobs/ticket-jobs.test.ts`

### Implementation for User Story 3

- [ ] T030 [US3] Preserve telemetry display while adding log context in `components/ticket/ticket-stats.tsx` and `components/ticket/jobs-timeline.tsx`
- [ ] T031 [US3] Keep metrics parsing stable while sharing normalized execution context with `lib/telemetry/otlp-processor.ts`
- [ ] T032 [US3] Ensure ticket job and timeline reads return log metadata alongside existing telemetry fields in `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts` and `app/api/projects/[projectId]/tickets/[id]/timeline/route.ts`

**Checkpoint**: Logs add narrative context without replacing or corrupting existing telemetry.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish retention/audit behavior, clone safety, and final validation across stories.

- [ ] T033 [P] Extend clone-behavior coverage so copied tickets keep job telemetry but not retained log artifacts in `tests/integration/tickets/duplicate.test.ts`
- [ ] T034 [P] Extend unavailable and pruned audit-state coverage in `tests/integration/jobs/logs.test.ts`
- [ ] T035 Implement retention-pruning state transitions and summary-only audit preservation in `lib/job-logs/storage.ts`
- [ ] T036 [P] Document capture, retrieval, and pruning execution details in `specs/AIB-720-capture-and-display/workflows/job-log-capture-workflow.md`, `specs/AIB-720-capture-and-display/workflows/job-log-retrieval-presentation.md`, and `specs/AIB-720-capture-and-display/workflows/job-log-retention-pruning.md`
- [ ] T037 Validate the completed feature against `prisma/schema.prisma`, `app/api/jobs/[id]/logs/route.ts`, and `components/ticket/job-log-dialog.tsx` with `bun run type-check`, `bun run lint`, `bun run test:unit`, and `bun run test:integration`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup** has no dependencies.
- **Phase 2: Foundational** depends on Phase 1 and blocks every user story.
- **Phase 3: US1** depends on Phase 2 and delivers the MVP.
- **Phase 4: US2** depends on Phase 2 and builds on shared normalization plus the US1 log surfaces.
- **Phase 5: US3** depends on Phase 2 and should land after US2 because it verifies the final telemetry-plus-log presentation.
- **Phase 6: Polish** depends on the stories you intend to ship.

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational; no dependency on another user story.
- **US2 (P2)**: Starts after Foundational; assumes the shared upload/read surfaces from US1 exist for preview and dialog reuse.
- **US3 (P3)**: Starts after Foundational; should follow US2 because it checks the combined telemetry and log presentation.

### Within Each User Story

- Tests must be written and fail before implementation tasks start.
- API contract and data-shape tasks should land before UI wiring tasks.
- Dialog and timeline rendering should follow the route and type changes they consume.

### Suggested Execution Order

1. Finish Phase 1.
2. Finish Phase 2.
3. Deliver Phase 3 as the MVP.
4. Deliver Phase 4 for successful-job readability.
5. Deliver Phase 5 for telemetry coexistence.
6. Finish Phase 6 before release.

---

## Parallel Opportunities

- Phase 1: `T002` can run in parallel with `T001`.
- Phase 2: `T006`, `T007`, `T008`, and `T011` can run in parallel after `T003` and `T004` define the storage contract.
- US1: `T012`, `T013`, and `T014` can run in parallel; `T019` can run in parallel with `T015` to `T018`.
- US2: `T021`, `T022`, and `T023` can run in parallel before the UI work starts.
- US3: `T028` and `T029` can run in parallel before telemetry-preservation updates.
- Polish: `T033`, `T034`, and `T036` can run in parallel with `T035`.

---

## Parallel Example: User Story 1

```bash
# Launch US1 test work together
Task: "Extend terminal callback and idempotent upload sequencing coverage in tests/integration/jobs/status.test.ts"
Task: "Create workflow-upload and member-scoped log-detail contract coverage in tests/integration/jobs/logs.test.ts"
Task: "Extend full-log CTA, unavailable-state, and nested-dialog coverage in tests/unit/components/ticket-detail-modal.test.tsx"

# Launch independent UI and API work after shared contracts land
Task: "Implement the workflow-authenticated terminal log upload route in app/api/jobs/[id]/logs/route.ts"
Task: "Create the detailed full-log dialog UI in components/ticket/job-log-dialog.tsx"
```

## Parallel Example: User Story 2

```bash
# Launch US2 validation work together
Task: "Extend successful-job preview payload coverage in tests/integration/jobs/ticket-jobs.test.ts"
Task: "Extend timeline preview serialization coverage in tests/integration/tickets/timeline.test.ts"
Task: "Create multi-agent normalization and summary extraction coverage in tests/unit/job-log-normalizer.test.ts"

# Split timeline and job-surface rendering once API shapes are stable
Task: "Render condensed successful-job previews in components/timeline/job-event-timeline-item.tsx and components/ticket/conversation-timeline.tsx"
Task: "Extend components/ticket/jobs-timeline.tsx and components/ticket/job-log-dialog.tsx to show concise successful-job summaries and ordered full-event formatting"
```

## Parallel Example: User Story 3

```bash
# Launch US3 verification work together
Task: "Extend telemetry-plus-log rendering coverage in tests/unit/components/ticket-stats.test.tsx"
Task: "Extend API coverage to confirm telemetry fields remain unchanged when log fields are present in tests/integration/jobs/ticket-jobs.test.ts"

# Split component and telemetry-pipeline updates
Task: "Preserve telemetry display while adding log context in components/ticket/ticket-stats.tsx and components/ticket/jobs-timeline.tsx"
Task: "Keep metrics parsing stable while sharing normalized execution context with lib/telemetry/otlp-processor.ts"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Deliver Phase 3 (US1) end to end.
3. Validate failed-job diagnosis independently before expanding scope.

### Incremental Delivery

1. Foundation first: schema, storage, normalization, workflow upload ordering.
2. MVP next: failed-job summary plus full-log dialog.
3. Then successful-job readability and normalized timeline previews.
4. Then telemetry coexistence and retention polish.

### Suggested MVP Scope

- Phase 1
- Phase 2
- Phase 3 (US1)

That scope solves the primary failure-diagnosis problem without waiting for the successful-run and telemetry refinements.

---

## Notes

- The only justified new test files are `tests/integration/jobs/logs.test.ts` and `tests/unit/job-log-normalizer.test.ts`.
- Existing test ownership from `research.md` is preserved everywhere else.
- New implementation files are limited to paths already called for by the design artifacts: `app/api/jobs/[id]/logs/route.ts`, `app/api/projects/[projectId]/jobs/[jobId]/logs/route.ts`, `app/lib/schemas/job-logs.ts`, `components/ticket/job-log-dialog.tsx`, `lib/job-logs/storage.ts`, `lib/job-logs/normalize.ts`, and `lib/job-logs/summary.ts`.
