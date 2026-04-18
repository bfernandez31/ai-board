# Tasks: Auto-transition mode on full-workflow tickets (AIB-682)

**Input**: Design documents from `/specs/AIB-682-auto-transition-mode/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included by default per constitution §III.

**Organization**: Grouped by user story (US1–US5) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- File paths are absolute from repo root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new infrastructure needed. `Ticket.autoMode` column already exists in `prisma/schema.prisma:141` and is already applied in `prisma/migrations/0_init/migration.sql`.

- [ ] T001 Verify `Ticket.autoMode Boolean @default(false)` is present at `prisma/schema.prisma:141` and run `bunx prisma generate` to confirm the client type exposes `autoMode`; no migration required.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure primitives shared across all user stories. These must land before any story's server/UI tasks can compile.

**CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 [P] Create `isAutoModeEligible(ticket)` predicate in `app/lib/tickets/auto-mode-eligibility.ts` returning `true` iff `workflowType === 'FULL'` AND `stage ∈ {INBOX, SPECIFY, PLAN}` (FR-001/003/004).
- [ ] T003 [P] Create `computeChainedStages(stage)` pure function in `lib/utils/auto-mode-stage-preview.ts` returning `['SPECIFY','PLAN','BUILD']` for INBOX, `['PLAN','BUILD']` for SPECIFY, `['BUILD']` for PLAN, `[]` otherwise.
- [ ] T004 [P] Create unit tests for `isAutoModeEligible` covering all `(workflowType, stage)` combinations in `tests/unit/auto-mode-eligibility.test.ts` (no existing file covers autoMode predicates).
- [ ] T005 [P] Create unit tests for `computeChainedStages` covering INBOX/SPECIFY/PLAN/BUILD/VERIFY/SHIP/CLOSED inputs in `tests/unit/auto-mode-stage-preview.test.ts` (no existing file covers this util).

**Checkpoint**: Pure primitives and their tests land green; stories can now start.

---

## Phase 3: User Story 1 — Fire-and-forget a full-workflow ticket from INBOX (Priority: P1) 🎯 MVP

**Goal**: Enabling auto-mode on an INBOX full-workflow ticket with no running job dispatches SPECIFY immediately, then PLAN after SPECIFY succeeds, then BUILD after PLAN succeeds — zero additional clicks (SC-001).

**Independent Test**: Starting from an INBOX full-workflow ticket with no running job, turn on auto-mode via the card's toggle icon, confirm the modal, and verify the ticket progresses through SPECIFY and PLAN and lands in BUILD without any further interaction.

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [ ] T006 [P] [US1] Create integration tests in `tests/integration/tickets/auto-mode.test.ts` covering: (a) PATCH `/api/projects/:projectId/tickets/:id/auto-mode` with `{enabled:true}` on INBOX + no running job → `autoMode=true`, new PENDING `specify` job created; (b) ineligible ticket (QUICK or stage=BUILD) → 400; (c) unauthorized user (no project access) → 403. No existing file covers the auto-mode endpoint.
- [ ] T007 [P] [US1] Create integration tests in `tests/integration/jobs/auto-mode-hook.test.ts` covering: (a) `specify` job COMPLETED + autoMode=true + stage=SPECIFY → stage advances to PLAN and PLAN job is created; (b) `plan` job COMPLETED + autoMode=true + stage=PLAN → stage advances to BUILD and BUILD job is created; (c) autoMode=false + COMPLETED → no auto-transition. No existing file drives job-status hook behavior for autoMode.
- [ ] T008 [P] [US1] Create Playwright E2E at `tests/e2e/board/auto-mode.spec.ts` verifying the happy-path chain INBOX → BUILD with exactly one confirmation modal and zero drags (SC-001). Use `[e2e]` prefix per CLAUDE.md.
- [ ] T009 [P] [US1] Create RTL test in `tests/unit/components/board/auto-mode-icon.test.tsx` asserting: off-state uses `opacity-0 group-hover:opacity-100`, on-state always visible with indigo ring halo, tooltip text varies by state (FR-005/006/007).
- [ ] T010 [P] [US1] Create RTL test in `tests/unit/components/board/auto-mode-confirmation-modal.test.tsx` asserting chained-stage preview text matches `computeChainedStages(stage).join(' → ')` for each eligible stage and confirm/cancel callbacks fire correctly (FR-008/012).

### Implementation for User Story 1

- [ ] T011 [P] [US1] Create `enableAutoMode({projectId, ticketIdentifier})` and `disableAutoMode(...)` service functions in `app/lib/tickets/auto-mode.ts`. `enableAutoMode`: validates eligibility via `isAutoModeEligible`, sets `autoMode=true`, detects RUNNING/PENDING non-`comment-*` jobs; if none running, calls `executeTicketTransition(projectId, ticketIdentifier, nextStage)` and on `{ok:false}` reverts `autoMode=false` and propagates the error (FR-010/021). `disableAutoMode`: sets `autoMode=false` only, never touches job rows (FR-014).
- [ ] T012 [P] [US1] Create `handleJobCompletionAutoTransition({jobId, terminalStatus})` in `app/lib/tickets/auto-mode.ts`. Loads `job.ticketId`, `job.command`, ticket stage/workflowType/autoMode/projectId. Short-circuits on `comment-*` commands. On COMPLETED + autoMode=true + eligible stage (SPECIFY/PLAN): computes `nextStage` via `getNextStage` and calls `executeTicketTransition`; on failure, sets `autoMode=false` and logs (never throws).
- [ ] T013 [US1] Create PATCH route handler in `app/api/projects/[projectId]/tickets/[id]/auto-mode/route.ts` with Zod body schema `z.object({ enabled: z.boolean() })`. Auth via `verifyProjectAccess()` (FR-002). Delegates to `enableAutoMode`/`disableAutoMode` from T011. Response shape: `{ autoMode: boolean, jobId?: string }` per `contracts/auto-mode-api.md`. Depends on T011.
- [ ] T014 [US1] Extend `app/api/jobs/[id]/status/route.ts` terminal-state branch (after the existing push-notification call around lines 250–258): invoke `handleJobCompletionAutoTransition({jobId, terminalStatus})` wrapped in `.catch(err => console.error(...))` so hook failures never fail the outer PATCH (pattern from `sendJobCompletionNotification`). Depends on T012.
- [ ] T015 [P] [US1] Create `components/board/auto-mode-icon.tsx` exporting a component with props `{ autoMode: boolean; onClick(e): void; disabled?: boolean }`. Uses `FastForward` from lucide-react. Off state: `opacity-0 group-hover:opacity-100 transition-opacity` mirroring `components/board/ticket-card.tsx:266` cancel-X. On state: `ring-2 ring-indigo-500 dark:ring-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.5)]` mirroring the custom-models halo at `ticket-card.tsx:182`. Wrap in shadcn `Tooltip` with text per FR-007.
- [ ] T016 [P] [US1] Create `components/board/auto-mode-confirmation-modal.tsx` as a Radix `AlertDialog` parallel to `components/board/cancel-confirmation-modal.tsx`. Props `{ open, onOpenChange, onConfirm, currentStage }`. Title "Enable auto-transition?"; description renders `computeChainedStages(currentStage).join(' → ') + " will run automatically."` (FR-008). Cancel leaves state unchanged (FR-012).
- [ ] T017 [P] [US1] Create `app/lib/hooks/mutations/useAutoMode.ts` TanStack mutation hook that PATCHes `/api/projects/:projectId/tickets/:id/auto-mode` with `{enabled}`. `onMutate`: optimistic update of ticket cache's `autoMode` field. `onError`: rollback optimistic cache. `onSuccess`: invalidate `tickets` and `jobs` query keys so the new PENDING job appears.
- [ ] T018 [US1] Extend `components/board/ticket-card.tsx`: import `isAutoModeEligible` and `useAutoMode`. If not eligible, skip rendering the icon (FR-003/004). Otherwise place `<AutoModeIcon />` in the left-side icon cluster next to cancel-X (around lines 259–272) so the shared `.group` parent enables `group-hover:opacity-100`. Click handler: if `ticket.autoMode === true`, call disable mutation immediately (FR-013); else open `AutoModeConfirmationModal` (state `showAutoModeModal`) and call enable mutation on confirm. Depends on T015, T016, T017.

**Checkpoint**: US1 fully functional — INBOX → SPECIFY → PLAN → BUILD chains with one confirmation click.

---

## Phase 4: User Story 2 — Enable auto-mode mid-flight while a job is running (Priority: P2)

**Goal**: Enabling auto-mode while a job is RUNNING does not dispatch a new transition; the chain kicks in when the running job completes successfully (FR-011).

**Independent Test**: On a full-workflow ticket in SPECIFY with a running SPECIFY job, toggle auto-mode on and confirm. Verify no new dispatch happens while the job runs; once the job completes successfully, PLAN is dispatched.

### Tests for User Story 2

- [ ] T019 [P] [US2] Extend `tests/integration/tickets/auto-mode.test.ts` (created in T006) with a scenario: enable on a ticket with a RUNNING `specify` job → `autoMode=true`, NO new PENDING job created, response includes no `jobId` (FR-011). Extend existing file rather than creating a new one.
- [ ] T020 [P] [US2] Extend `tests/integration/jobs/auto-mode-hook.test.ts` (created in T007) with a scenario: ticket where autoMode was toggled on mid-RUNNING → when that SPECIFY job transitions to COMPLETED, the hook dispatches PLAN.

### Implementation for User Story 2

- [ ] T021 [US2] In `app/lib/tickets/auto-mode.ts` (`enableAutoMode` from T011), ensure the "running job detection" query filters Jobs with `status ∈ {PENDING, RUNNING}` AND `NOT command.startsWith('comment-')` AND `ticketId === ticket.id`. When such a job exists, skip the dispatch branch (set `autoMode=true` only) per FR-011. Covered by T019's assertions. Depends on T011.

**Checkpoint**: US2 verified — enabling mid-flight defers the chain to job completion.

---

## Phase 5: User Story 3 — Auto-mode halts on failure so the user can intervene (Priority: P1)

**Goal**: On FAILED or CANCELLED terminal status (including immediate dispatch-time failures), `autoMode` flips to `false` and the ticket stays on its current stage (FR-018/019/021).

**Independent Test**: On a ticket with auto-mode on, force a stage job to fail or be cancelled, then verify auto-mode is off (icon reverts to hover-only), stage is unchanged, and no further transition is dispatched.

### Tests for User Story 3

- [ ] T022 [P] [US3] Extend `tests/integration/jobs/auto-mode-hook.test.ts` (created in T007) with: (a) `specify` job FAILED + autoMode=true → `autoMode=false`, stage stays SPECIFY, no new job; (b) `plan` job CANCELLED + autoMode=true → `autoMode=false`, stage stays PLAN, no new job; (c) COMPLETED on BUILD-stage ticket with autoMode=true → hook takes no autoMode-specific action (existing BUILD→VERIFY path already handles it); (d) hook never throws even if `executeTicketTransition` rejects (FR-021 via hook). Extend rather than duplicate.
- [ ] T023 [P] [US3] Extend `tests/integration/tickets/auto-mode.test.ts` (created in T006) with: enable on eligible ticket where immediate dispatch fails (e.g., owner missing `UserCredential` — stub the dispatch to return `{ok:false}`) → response is 4xx/5xx, `autoMode` reverts to `false` in DB (FR-021).

### Implementation for User Story 3

- [ ] T024 [US3] In `handleJobCompletionAutoTransition` (T012) in `app/lib/tickets/auto-mode.ts`, implement the failure branch: if `terminalStatus ∈ {FAILED, CANCELLED}` AND `ticket.autoMode === true`, run `prisma.ticket.update({ data: { autoMode: false } })` and return (FR-018/019). Use `isTerminalStatus` from `app/lib/job-state-machine.ts` rather than inlining status arrays. Depends on T012.
- [ ] T025 [US3] In `enableAutoMode` (T011), ensure the dispatch-failure branch reverts `autoMode` to `false` via a second `prisma.ticket.update` when `executeTicketTransition` returns `{ok:false}` — matches the dispatch-then-rollback pattern at `lib/tickets/transition.ts:367-384`. Surface the original error to the PATCH route so the client receives an appropriate status code. Depends on T011.

**Checkpoint**: US3 verified — no silent advances past failed/cancelled jobs; SC-002 satisfied.

---

## Phase 6: User Story 4 — Disable auto-mode at any time (Priority: P2)

**Goal**: Clicking the icon while auto-mode is on disables it instantly with no modal and without affecting any running job; subsequent successful completion does not auto-transition (FR-013/014/015).

**Independent Test**: On a ticket with auto-mode on and a job running, click the fast-forward icon once. Verify auto-mode disengages instantly (no modal), icon reverts to hover-only, and when the running job eventually completes successfully, no automatic transition happens.

### Tests for User Story 4

- [ ] T026 [P] [US4] Extend `tests/integration/tickets/auto-mode.test.ts` (T006) with: PATCH `{enabled:false}` on a ticket with autoMode=true and a RUNNING job → `autoMode=false`, running Job row untouched (status/command unchanged), no new jobs created (FR-013/014).
- [ ] T027 [P] [US4] Extend `tests/integration/jobs/auto-mode-hook.test.ts` (T007) with: ticket had autoMode flipped off mid-RUNNING, running job then COMPLETED → no auto-transition dispatched (FR-014 end-state).
- [ ] T028 [P] [US4] Extend `tests/unit/components/board/auto-mode-icon.test.tsx` (T009) with: clicking the icon in on-state fires `onClick` without opening any modal (asserts via RTL that `AutoModeConfirmationModal` is not rendered). Extend rather than duplicate.

### Implementation for User Story 4

- [ ] T029 [US4] In `ticket-card.tsx` click handler (T018), branch on `ticket.autoMode`: if true, call `useAutoMode` mutation with `{enabled:false}` directly and return (no modal) — FR-013; if false, open the confirmation modal. Depends on T018.

**Checkpoint**: US4 verified — disable is instant, running jobs are untouched.

---

## Phase 7: User Story 5 — Rolling back from VERIFY to PLAN disengages auto-mode (Priority: P2)

**Goal**: The VERIFY → PLAN rollback turns `autoMode` off atomically within the existing rollback transaction, preventing the PLAN → BUILD → VERIFY infinite loop (FR-022, SC-004).

**Independent Test**: Ticket in VERIFY with auto-mode on. Trigger the VERIFY → PLAN rollback. After rollback, ticket is in PLAN and `autoMode=false` (icon hover-only).

### Tests for User Story 5

- [ ] T030 [P] [US5] Extend `tests/integration/tickets/transitions.test.ts` (existing) with one scenario: ticket in VERIFY with `autoMode=true` → execute rollback to PLAN → final state `stage=PLAN`, `autoMode=false`. Per research.md §"Testing location for rollback disengage", extend this existing file rather than creating a new one.

### Implementation for User Story 5

- [ ] T031 [US5] Extend `rollbackToPlanWithReset()` in `lib/tickets/transition.ts` (around lines 69–79) by adding `autoMode: false` to the existing `updateData` object inside the same `$transaction` — do NOT add a second query (FR-022). The same helper serves BUILD→PLAN rollbacks as well; setting `autoMode=false` there is a safe no-op since BUILD is not auto-mode-eligible.

**Checkpoint**: US5 verified — no infinite loop risk after rollback; SC-004 satisfied.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T032 [P] Run `bun run type-check` and `bun run lint` across all new/modified files; fix any errors in the AIB-682 diff (even pre-existing errors in edited files per CLAUDE.md commit rules).
- [ ] T033 [P] Confirm all new text tokens (tooltip strings, modal copy) use semantic Tailwind classes and avoid hex/rgb literals except the explicitly-permitted indigo accent classes (CLAUDE.md Colors rule).
- [ ] T034 Manually verify SC-005 (on-state visible without hover from board level) by loading `/` in the dev server with a ticket whose `autoMode=true` and confirming the indigo halo is always visible across light and dark themes.
- [ ] T035 Verify SC-006 (QUICK-workflow tickets never render the icon) via a targeted RTL assertion in `tests/unit/components/board/auto-mode-icon.test.tsx` OR in `ticket-card.tsx` tests: rendering a ticket with `workflowType='QUICK'` does not include the fast-forward icon.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: T001 is a single verification task — no code changes.
- **Phase 2 (Foundational)**: Depends on Phase 1. T002 and T003 are independent; T004 depends on T002; T005 depends on T003.
- **Phase 3 (US1 MVP)**: Depends on Phase 2 (`isAutoModeEligible`, `computeChainedStages`).
- **Phase 4 (US2)**: Depends on Phase 3 (T011). Tests in T019/T020 may be written in parallel but assert behavior that depends on T021.
- **Phase 5 (US3)**: Depends on Phase 3 (T011, T012). Tests T022/T023 may be written in parallel with implementation; T024 depends on T012; T025 depends on T011.
- **Phase 6 (US4)**: Depends on Phase 3 (T017, T018). T026/T027/T028 may be written in parallel; T029 depends on T018.
- **Phase 7 (US5)**: Independent of all other stories except Phase 2 is not required (this phase touches only `lib/tickets/transition.ts`). Can start immediately after Setup if desired.
- **Phase 8 (Polish)**: Depends on all desired stories being complete.

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 primitives only. Produces the endpoint, hook, UI, and MVP behavior.
- **US2 (P2)**: Tests extend US1's files; impl (T021) is a small branch inside `enableAutoMode` from US1.
- **US3 (P1)**: Tests extend US1's hook file; impl extends US1's service (T024, T025).
- **US4 (P2)**: Tests extend US1's files; impl is a client-side branch in `ticket-card.tsx` (T029).
- **US5 (P2)**: Fully independent — touches only `lib/tickets/transition.ts` and its test. Can ship separately.

### Within Each User Story

- Tests MUST be written and FAIL before implementation (constitution §III).
- Pure primitives (Phase 2) before services.
- Services before routes/hooks.
- Server before client.
- Components before wiring into `ticket-card.tsx`.

### Parallel Opportunities

- Phase 2: T002 + T003 in parallel; T004 + T005 in parallel.
- Phase 3 tests: T006, T007, T008, T009, T010 all independent files → parallel.
- Phase 3 impl: T011 and T012 are in the same file and must be sequential within it; T015, T016, T017 are independent files → parallel.
- Phase 5 tests T022, T023 are independent files → parallel.
- Phase 7 (US5) can run fully in parallel with any/all other stories.
- Phase 8: T032, T033 in parallel.

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together (different files):
Task: "Integration tests for auto-mode endpoint in tests/integration/tickets/auto-mode.test.ts"
Task: "Integration tests for job-status hook in tests/integration/jobs/auto-mode-hook.test.ts"
Task: "E2E chain test in tests/e2e/board/auto-mode.spec.ts"
Task: "RTL tests for AutoModeIcon in tests/unit/components/board/auto-mode-icon.test.tsx"
Task: "RTL tests for AutoModeConfirmationModal in tests/unit/components/board/auto-mode-confirmation-modal.test.tsx"

# Launch independent US1 client files together:
Task: "Create AutoModeIcon in components/board/auto-mode-icon.tsx"
Task: "Create AutoModeConfirmationModal in components/board/auto-mode-confirmation-modal.tsx"
Task: "Create useAutoMode hook in app/lib/hooks/mutations/useAutoMode.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 3 Only)

US3 is also P1 (safety property). Ship US1 and US3 together as MVP:

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Foundational).
3. Complete Phase 3 (US1).
4. Complete Phase 5 (US3) — reuses US1's service file with a failure branch.
5. **STOP and VALIDATE**: happy-path chain works AND failures halt the chain.
6. Deploy / demo as MVP.

### Incremental Delivery

1. Setup + Foundational → green.
2. US1 + US3 → ship MVP (full-workflow chain with failure safety).
3. US2 → mid-flight enable.
4. US4 → mid-flight disable.
5. US5 → rollback interaction (can actually ship standalone at any time).

### Parallel Execution Strategy

After Phase 2 completes:
- Track A: US1 → US2 → US4 (all touch the same endpoint + UI; serialize within the track).
- Track B: US3 (parallel with Track A after T011, T012 exist).
- Track C: US5 (fully parallel with everything; touches only `lib/tickets/transition.ts`).

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Tests use `[e2e]` prefix for project/ticket names per CLAUDE.md.
- Hook in `app/api/jobs/[id]/status/route.ts` MUST use `.catch(err => console.error(...))` so hook failures never fail the outer PATCH (mirrors `sendJobCompletionNotification`).
- Rollback change in `lib/tickets/transition.ts` MUST reuse the existing `$transaction` — no second query.
- All new `fetch` interactions from the client go through the `useAutoMode` TanStack mutation — no raw `fetch` in components.
