---
description: "Tasks: Per-stage model configuration for Claude workflows (AIB-678)"
---

# Tasks: Per-Stage Model Configuration for Claude Workflows

**Input**: Design documents from `/specs/AIB-678-per-stage-model/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Test tasks included per constitution §III (no explicit opt-out from user).

**Organization**: Tasks are grouped by user story (US1–US4, mapping to spec.md priorities P1/P1/P2/P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label — only on Phase 3+ story tasks (US1, US2, US3, US4)
- All file paths are absolute from repo root (`/home/runner/work/ai-board/ai-board/target/`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema + generated client are prerequisites for every later phase.

- [X] T001 ✅ DONE — Extended `prisma/schema.prisma` with 5 nullable `String? @db.VarChar(50)` columns on both `Project` (after `defaultBranch`) and `Ticket` (after `agent`).
- [X] T002 ✅ DONE — Migration `20260418172728_aib_678_per_stage_model` created (10 additive nullable columns, no defaults) and Prisma client regenerated.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared whitelist + Zod primitives consumed by every user story. **All subsequent phases depend on these.**

- [X] T003 ✅ DONE — Created `lib/models/claude-models.ts` with whitelist, labels, smart defaults, type guard, and stage-key helpers.
- [X] T004 ✅ DONE — Created `app/lib/schemas/model-config.ts` with `claudeModelIdSchema` and `ticketModelOverrideSchema`.

**Checkpoint**: Whitelist + schemas available. User stories may begin in parallel.

---

## Phase 3: User Story 1 - Configure default model per stage for a project (Priority: P1) 🎯 MVP

**Goal**: Project owner/member can pick a Claude model per stage in Settings; value persists and is exposed by the Project API.

**Independent Test**: Open Settings on a Claude project, change IMPLEMENT to Sonnet 4.6 via the AI Models card, confirm `project.implementModel` is updated and dispatching an IMPLEMENT job (no override) carries Sonnet 4.6.

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [X] T005 ✅ DONE — Extended `tests/integration/projects/settings.test.ts` with per-stage PATCH cases covering all 5 fields, isolation, null reset, INVALID_MODEL_ID rejection, non-member 404 and member-allowed.
- [X] T006 ✅ DONE — Created `tests/unit/components/ai-models-card.test.tsx` covering Claude vs non-Claude branches, stage rows, smart-defaults button, and seeded value display.

### Implementation for User Story 1

- [X] T007 ✅ DONE — Extended `projectUpdateSchema` in `app/lib/schemas/clarification-policy.ts` with the 5 nullable optional model fields.
- [X] T008 ✅ DONE — PATCH handler in `app/api/projects/[projectId]/route.ts` returns `code: 'INVALID_MODEL_ID'` on model refinement failures; `updateProject` in `lib/db/projects.ts` now accepts the 5 model fields and resolves auth against owner-or-member.
- [X] T009 ✅ DONE — Created `components/settings/ai-models-card.tsx` with 5 rows, fallback sentinel, apply-smart-defaults button, and non-Claude info message.
- [X] T010 ✅ DONE — Mounted `<AIModelsCard />` in `app/projects/[projectId]/settings/page.tsx`.

**Checkpoint**: US1 complete — per-project settings round-trip through API and UI.

---

## Phase 4: User Story 2 - Resolve effective model at workflow dispatch (Priority: P1)

**Goal**: At dispatch time, system resolves ticket → project → global fallback, writes `Job.model`, and emits `model` in `workflowInputs` (Claude only).

**Independent Test**: For each layer (fallback only / project only / ticket override) dispatch each of the 5 job types and verify (a) `Job.model` on the created row matches the expected resolution; (b) dispatch input contains the same `model` string; (c) non-Claude agent → no `model` key emitted and `Job.model` is `null`.

### Tests for User Story 2

**NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [X] T011 ✅ DONE — Created `tests/unit/workflows/model-resolution.test.ts` (25 passing cases: ticket > project > fallback for each command, non-configurable commands, non-Claude agents, stale values).
- [X] T012 ✅ DONE — Extended `tests/integration/tickets/transitions.test.ts` with Job.model dispatch cases for project default, ticket override (quick-impl), and non-Claude dormant branch.

### Implementation for User Story 2

- [X] T013 ✅ DONE — Created `lib/workflows/model-resolution.ts` with pure `resolveStageModel` matching the 5-step algorithm.
- [X] T014 ✅ DONE — Wired `resolveStageModel` into `lib/workflows/transition.ts`: passes `model` into both `prisma.job.create` blocks and spreads `...(resolvedModel && { model })` into all three dispatch payloads.

**Checkpoint**: US2 complete — resolution + Job.model + dispatch payload all wired. Workflow YAMLs ingest the new input in Phase 7.

---

## Phase 5: User Story 3 - Override a single ticket's models (Priority: P2)

**Goal**: Team lead opens a per-ticket model dialog, sets any subset of the 5 stages (or Reset All), sees the "Custom models" badge on the ticket card.

**Independent Test**: Open override dialog on a ticket, set VERIFY to Opus 4.7, save; badge appears with tooltip enumerating "VERIFY"; dispatch a VERIFY job — Opus 4.7 used; other stage dispatches still resolve to project defaults; Reset All clears badge.

### Tests for User Story 3

**NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [X] T015 ✅ DONE — Created `tests/integration/tickets/model-override.test.ts` with single-stage override, resetAll, INVALID_MODEL_ID, empty-body 400, non-member 404, member-allowed, and defaultAgent-change-preserves-override cases.
- [X] T016 ✅ DONE — Created `tests/unit/components/model-override-dialog.test.tsx` with 5 passing cases (stage rows, non-Claude branch, save-disabled, reset-all, error surface).
- [X] T017 ✅ DONE — Created `tests/unit/components/board/ticket-card-model-badge.test.tsx` with 3 passing cases (no badge when all null, badge when any set, dormant variant when non-Claude).

### Implementation for User Story 3

- [X] T018 ✅ DONE — Created `app/api/projects/[projectId]/tickets/[id]/model-config/route.ts` with PATCH validating via `ticketModelOverrideSchema`, `verifyTicketAccess`, resetAll semantics, and overriddenStages response contract.
- [X] T019 ✅ DONE — Created `components/tickets/model-override-dialog.tsx` with 5 Select rows, project-default sentinel, Reset-all button, non-Claude info branch, and error handling.
- [X] T020 ✅ DONE — Extended `components/board/ticket-card.tsx` with "Custom models" badge after agent badge; tooltip enumerates overridden stages and suffixes dormant note when effective agent is non-Claude; extended `TicketWithVersion` with 5 model columns.

**Checkpoint**: US3 complete — per-ticket override dialog + badge + endpoint all live.

---

## Phase 6: User Story 4 - Smart defaults for new projects (Priority: P2)

**Goal**: New projects created with the 5 smart-default values persisted; existing-project owners can opt-in via a single Settings action.

**Independent Test**: (a) Create a new project, inspect it — `specifyModel='claude-opus-4-7'`, `planModel='claude-opus-4-7'`, `implementModel='claude-sonnet-4-6'`, `quickImplModel='claude-sonnet-4-6'`, `verifyModel='claude-sonnet-4-6'`. (b) On a null-column (existing) project, POST to apply-smart-defaults — all 5 columns reflect `SMART_DEFAULTS`.

### Tests for User Story 4

**NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [X] T021 ✅ DONE — Extended `tests/integration/projects/crud.test.ts` with a SMART_DEFAULTS persistence case for newly-created projects.
- [X] T022 ✅ DONE — Created `tests/integration/projects/model-config.test.ts` with atomic-write, idempotent, member-allowed, and non-member 404 cases.

### Implementation for User Story 4

- [X] T023 ✅ DONE — `app/api/projects/route.ts` POST now spreads `...SMART_DEFAULTS` into the in-transaction `project.create`; `lib/db/projects.ts#createProject` also seeds SMART_DEFAULTS for the no-limit path.
- [X] T024 ✅ DONE — Created `app/api/projects/[projectId]/model-config/apply-smart-defaults/route.ts` with `verifyProjectAccess` and single atomic update.
- [X] T025 ✅ DONE — `components/settings/ai-models-card.tsx` (from T009) already POSTs to the new endpoint via the apply-smart-defaults button.

**Checkpoint**: US4 complete — smart defaults seeded at creation and available as opt-in.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T026 ✅ DONE — Added optional `model` input to `.github/workflows/speckit.yml` and wired it into `ANTHROPIC_MODEL` (falls back to `claude-opus-4-7`).
- [X] T027 ✅ DONE — Added optional `model` input to `.github/workflows/quick-impl.yml` and wired it into `ANTHROPIC_MODEL`.
- [X] T028 ✅ DONE — Added optional `model` input to `.github/workflows/verify.yml` and exposed `ANTHROPIC_MODEL` with the same fallback semantics.
- [X] T029 ✅ DONE — `bun run type-check` and `bun run lint` both clean. Extended `TicketWithVersion` + `TICKET_SELECT` + optimistic construction sites (useCreateTicket, board.handleTicketUpdate, ticket-detail-modal duplicate) with the 5 new model fields.
- [ ] T030 Manual smoke pass: dispatch one SPECIFY and one VERIFY on a test project with (a) no overrides, (b) project default only, (c) ticket override — verify `Job.model` values match expected resolution in each case (SC-001). (Deferred — requires live workflow environment.)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Must complete first — schema + client are preconditions for every typed reference.
- **Phase 2 (Foundational)**: Depends on Phase 1. Blocks all user stories (whitelist/schema are imported everywhere).
- **Phase 3 (US1)**: Depends on Phase 2. MVP.
- **Phase 4 (US2)**: Depends on Phase 2. Runs in parallel with US1 (different files).
- **Phase 5 (US3)**: Depends on Phase 2. May build on US1's `ai-models-card` but does not require it; endpoint, dialog, and badge are independent files.
- **Phase 6 (US4)**: Depends on Phase 2 and — for the UI button (T025) — on T009 from US1. The seeding (T023) and endpoint (T024) tasks are independent.
- **Phase 7 (Polish)**: Depends on US2 (workflow inputs) being complete so YAML forwarding has something to receive.

### Within Each User Story

- Tests authored and failing before implementation.
- Schema extension → API handler → UI (for US1).
- Pure function → transition wiring (for US2).
- Endpoint → dialog → ticket-card badge (for US3).
- Transaction seeding + endpoint → UI button (for US4).

### Parallel Opportunities

- T003 ∥ T004 (different files, both in Phase 2).
- Within US1: T005 ∥ T006 (test files); T007 ∥ T009 (schema + component) once T005/T006 exist.
- Within US2: T011 ∥ T012 (test files).
- Within US3: T015 ∥ T016 ∥ T017 (three independent test files); T018 ∥ T019 (endpoint + dialog); T020 depends on T019.
- Within US4: T021 ∥ T022 (test files); T023 ∥ T024 (creation seed vs new endpoint); T025 depends on T024 and T009.
- Phase 7: T026 ∥ T027 ∥ T028 (three independent YAML files).
- US1, US2, US3, US4 implementation phases can largely proceed in parallel once Phase 2 finishes — the only shared file is `components/settings/ai-models-card.tsx` (T009 created by US1, extended by US4 T025).

---

## Parallel Example: Phase 2 + launching US1 + US2

```bash
# After Phase 1 completes, launch Phase 2 foundational tasks in parallel:
Task: "Create whitelist module lib/models/claude-models.ts (T003)"
Task: "Create Zod schemas app/lib/schemas/model-config.ts (T004)"

# Once Phase 2 completes, launch US1 + US2 tests in parallel:
Task: "Extend tests/integration/projects/settings.test.ts with per-stage PATCH cases (T005)"
Task: "Create tests/unit/components/ai-models-card.test.tsx (T006)"
Task: "Create tests/unit/workflows/model-resolution.test.ts (T011)"
Task: "Extend tests/integration/tickets/transitions.test.ts with Job.model cases (T012)"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

Together, US1 and US2 constitute the functional MVP: project owners can configure per-stage defaults (US1) AND dispatches use those values (US2). Without US2, US1 is a cosmetic-only change; without US1, US2 never sees a non-fallback resolution.

1. Complete Phase 1 (schema + migration).
2. Complete Phase 2 (whitelist + Zod).
3. Complete Phase 3 (US1) and Phase 4 (US2) — can run in parallel.
4. Run Phase 7 workflow YAML updates (T026–T028) so Claude workflows ingest the new input.
5. **STOP and VALIDATE**: dispatch each of the 5 commands on a test project — confirm `Job.model` matches expected resolution and Claude agent actually uses it.

### Incremental Delivery

1. MVP (US1 + US2 + workflow YAMLs) → ship.
2. Add US3 (ticket override) → ship.
3. Add US4 (smart defaults seeding + opt-in) → ship.
4. Polish pass (T029, T030) after all stories land.

### Parallel Execution Strategy

ai-board can execute US1–US4 implementation phases concurrently after Phase 2:

- Stream 1: US1 (Phase 3) — settings card path.
- Stream 2: US2 (Phase 4) — resolution + transition wiring.
- Stream 3: US3 (Phase 5) — ticket override path.
- Stream 4: US4 (Phase 6) — seed + opt-in, coordinating T025 with US1's T009.

---

## Notes

- **File path validation**: every referenced file either exists today (verified via filesystem for `prisma/schema.prisma`, the three `components/settings/*.tsx` pattern files, `components/tickets/agent-edit-dialog.tsx`, `components/board/ticket-card.tsx`, `lib/workflows/transition.ts`, the `app/api/projects/**` routes, `app/lib/schemas/clarification-policy.ts`, the four integration test files, and the unit-test pattern files) or is explicitly a NEW file per `research.md` §"Existing Files".
- **New test files are justified**: `tests/unit/workflows/model-resolution.test.ts` (no existing `tests/unit/workflows/` directory); `tests/unit/components/ai-models-card.test.tsx` and `tests/unit/components/model-override-dialog.test.tsx` (no existing coverage for these components); `tests/unit/components/board/ticket-card-model-badge.test.tsx` (no existing `ticket-card.test.tsx`, and the badge is a discrete concern); `tests/integration/projects/model-config.test.ts` and `tests/integration/tickets/model-override.test.ts` (dedicated endpoints, no existing coverage).
- **Existing files extended, not duplicated**: `tests/integration/projects/settings.test.ts`, `tests/integration/projects/crud.test.ts`, and `tests/integration/tickets/transitions.test.ts` already own their respective domains and are extended, not replaced.
- **Commit cadence**: commit after each task or logical group; always run `bun run type-check` and `bun run lint` before committing (CLAUDE.md rule — never bypass hooks).
- **Schema regeneration**: after T001/T002, re-run `bunx prisma generate` to refresh TypeScript types used by T008, T013, T014, T018, T023, T024.
